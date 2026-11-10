import type { LyricLine, LyricSyllable, LyricsAttribution, LyricsResult } from './types.js';

/**
 * Client for the Spicy Lyrics API (https://developers.spicylyrics.org).
 *
 *  - GET /v1/tracks/search  title/artist/album/duration -> Spotify track ids
 *  - GET /v1/lyrics/{id}    best available sync for that Spotify track id
 *
 * The key is a bearer token. It lives in the user's local settings and is only
 * ever sent from this process to api.spicylyrics.org.
 */

/** Overridable for tests only (SPICY_LYRICS_API_URL). */
const BASE_URL = process.env.SPICY_LYRICS_API_URL ?? 'https://api.spicylyrics.org';
const TIMEOUT_MS = 12_000;

export class SpicyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    /** Seconds to wait before retrying (429 / 503). */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'SpicyError';
  }
  /** Worth trying again later; do not cache as "no lyrics". */
  get transient(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

async function request<T>(pathAndQuery: string, key: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${pathAndQuery}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', 'User-Agent': 'Sonora' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new SpicyError(err instanceof Error ? err.message : 'Network error', 0, 'network_error');
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON body: fall through to the status handling below.
  }
  if (!res.ok) {
    const code = typeof json?.error === 'string' ? json.error : undefined;
    const retry = Number(res.headers.get('retry-after') ?? res.headers.get('ratelimit-reset'));
    throw new SpicyError(
      json?.message ?? json?.Body?.message ?? `Spicy Lyrics API returned ${res.status}${code ? ` (${code})` : ''}`,
      res.status,
      code,
      Number.isFinite(retry) && retry > 0 ? retry : undefined,
    );
  }
  return json as T;
}

// ---- Search ----

export type MatchTier = 'exact' | 'likely' | 'version' | 'other_artist' | 'related';

export interface SearchResult {
  id: string;
  title: string;
  artists: string[];
  album: string | null;
  duration: number;
  tier: MatchTier;
  variants?: Array<{ id: string; album?: string | null; duration: number }>;
}

export interface SearchParams {
  title: string;
  artist?: string | null;
  album?: string | null;
  /** Seconds. Always send it when known: it is what tells versions apart. */
  duration?: number | null;
}

export async function searchTracks(key: string, p: SearchParams): Promise<SearchResult[]> {
  const q = new URLSearchParams({ title: p.title });
  if (p.artist) q.set('artist', p.artist);
  if (p.album) q.set('album', p.album);
  if (p.duration && p.duration > 0) q.set('duration', p.duration.toFixed(3));
  q.set('limit', '5');
  const env = await request<{ Body?: { results?: SearchResult[] } }>(`/v1/tracks/search?${q}`, key);
  return env.Body?.results ?? [];
}

// ---- Lyrics ----

interface RawSyllable { Text: string; StartTime?: number; EndTime?: number; IsPartOfWord?: boolean }
interface RawGroup { Syllables?: RawSyllable[]; StartTime?: number; EndTime?: number }
interface RawContributor { username?: string; url?: string }

export interface RawLyricsBody {
  Type: 'Syllable' | 'Line' | 'Static';
  id: string;
  source?: string;
  Content?: Array<{
    OppositeAligned?: boolean;
    Lead?: RawGroup;
    Background?: RawGroup[];
    Text?: string;
    StartTime?: number;
    EndTime?: number;
  }>;
  Lines?: Array<{ Text: string }>;
  UploadAttribution?: { Uploader?: RawContributor; Maker?: RawContributor };
}

export async function getLyrics(key: string, spotifyId: string): Promise<RawLyricsBody> {
  const env = await request<{ Body: RawLyricsBody }>(`/v1/lyrics/${encodeURIComponent(spotifyId)}`, key);
  if (!env.Body) throw new SpicyError('Empty response from Spicy Lyrics', 502, 'upstream_error');
  return env.Body;
}

const joinSyllables = (syl: RawSyllable[]) =>
  syl.map((s, i) => s.Text + (s.IsPartOfWord || i === syl.length - 1 ? '' : ' ')).join('').trim();

/** Convert the API's three lyric shapes (Syllable / Line / Static) to Sonora's format. */
export function toLyricsResult(body: RawLyricsBody): LyricsResult {
  const source: LyricsResult['source'] =
    body.source === 'apple_music' || body.source === 'spotify' ? body.source : 'spicy_lyrics';

  let attribution: LyricsAttribution | undefined;
  const up = body.UploadAttribution;
  if (source === 'spicy_lyrics' && up?.Uploader?.username) {
    attribution = {
      uploader: { username: up.Uploader.username, url: up.Uploader.url },
      ...(up.Maker?.username ? { maker: { username: up.Maker.username, url: up.Maker.url } } : {}),
    };
  }
  const base = { source, spotifyId: body.id, ...(attribution ? { attribution } : {}) };

  if (body.Type === 'Static') {
    const text = (body.Lines ?? []).map((l) => l.Text).join('\n').trim();
    return { synced: false, lines: null, plainText: text || null, ...base };
  }

  const lines: LyricLine[] = [];
  for (const c of body.Content ?? []) {
    if (body.Type === 'Syllable' && c.Lead?.Syllables?.length) {
      const syllables: LyricSyllable[] = c.Lead.Syllables.map((s) => ({
        text: s.Text,
        start: s.StartTime ?? c.Lead?.StartTime ?? 0,
        end: s.EndTime ?? c.Lead?.EndTime ?? 0,
        ...(s.IsPartOfWord ? { partOfWord: true } : {}),
      }));
      let text = joinSyllables(c.Lead.Syllables);
      const bg = (c.Background ?? [])
        .map((g) => joinSyllables(g.Syllables ?? []))
        .filter(Boolean)
        .join(' ');
      if (bg) text += ` ${/^\(.*\)$/.test(bg) ? bg : `(${bg})`}`;
      lines.push({
        time: c.Lead.StartTime ?? syllables[0].start,
        end: c.Lead.EndTime ?? syllables[syllables.length - 1].end,
        text,
        syllables,
        ...(c.OppositeAligned ? { oppositeAligned: true } : {}),
      });
    } else if (typeof c.Text === 'string' && c.Text.trim()) {
      lines.push({
        time: c.StartTime ?? 0,
        ...(c.EndTime !== undefined ? { end: c.EndTime } : {}),
        text: c.Text.trim(),
        ...(c.OppositeAligned ? { oppositeAligned: true } : {}),
      });
    }
  }
  lines.sort((a, b) => a.time - b.time);
  return { synced: lines.length > 0, lines: lines.length ? lines : null, plainText: null, ...base };
}

// ---- Matching ----

/** Strip the noise that makes titles/artists miss: "[Explicit]", "(feat. X)", "- Remastered". */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[[(](?:feat\.?|ft\.?|featuring)\s[^\])]*[\])]/gi, '')
    .replace(/\s*[[(](?:explicit|clean|bonus track|remaster(?:ed)?(?: \d{4})?)[\])]/gi, '')
    .replace(/\s+-\s+(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The main artist: first of "A; B", "A / B" or "A feat. B". Band names like "Juniper & Ash" stay whole. */
export function primaryArtist(artist: string): string {
  return artist.split(/\s*(?:;|\/|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b)\s*/i)[0].trim();
}

/** Tolerance (seconds) between our file's length and the matched release. */
const EXACT_TOLERANCE = 5;
const LIKELY_TOLERANCE = 2.5;

export interface Match {
  spotifyId: string;
  tier: MatchTier;
  /** |difference| in seconds, when both durations were known. */
  durationDelta: number | null;
}

/**
 * Pick the Spotify track for a local file, or null. A different version of a
 * song has different timings, so we only accept `exact` (or `likely` with a
 * very close duration) and, when a recording has several releases, choose the
 * one whose length is closest to the local file.
 */
export function pickMatch(results: SearchResult[], localDuration: number | null): Match | null {
  const known = localDuration !== null && localDuration > 0;
  for (const tier of ['exact', 'likely'] as const) {
    const tolerance = tier === 'exact' ? EXACT_TOLERANCE : LIKELY_TOLERANCE;
    for (const r of results) {
      if (r.tier !== tier) continue;
      const candidates = [{ id: r.id, duration: r.duration }, ...(r.variants ?? [])];
      let best: { id: string; delta: number | null } | null = null;
      for (const c of candidates) {
        const delta = known && c.duration > 0 ? Math.abs(c.duration - (localDuration as number)) : null;
        if (delta !== null && delta > tolerance) continue;
        if (!best || (delta !== null && (best.delta === null || delta < best.delta))) best = { id: c.id, delta };
      }
      // `likely` can't be confirmed without a duration to compare.
      if (best && (tier === 'exact' || best.delta !== null)) {
        return { spotifyId: best.id, tier, durationDelta: best.delta };
      }
    }
  }
  return null;
}
