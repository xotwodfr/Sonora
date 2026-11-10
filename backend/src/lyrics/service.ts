import path from 'node:path';
import { getDb } from '../db/index.js';
import type { TrackRow } from '../db/library.js';
import { getSpicyKey } from '../settings.js';
import { readLocalLyrics } from './local.js';
import { SpicyError, cleanTitle, getLyrics, pickMatch, primaryArtist, searchTracks, toLyricsResult } from './spicy.js';
import type { LyricsResult } from './types.js';

const DAY = 86_400;
/** Re-check found lyrics now and then: community syncs improve over time. */
const FOUND_TTL = 30 * DAY;
/** Don't ask again straight away about tracks with no lyrics. */
const NONE_TTL = 3 * DAY;

interface CacheRow { status: 'found' | 'none'; payload: string | null; fetched_at: number }

function readCache(trackId: number): LyricsResult | null | undefined {
  const row = getDb().prepare('SELECT status, payload, fetched_at FROM lyrics_cache WHERE track_id = ?')
    .get(trackId) as CacheRow | undefined;
  if (!row) return undefined;
  const age = Math.floor(Date.now() / 1000) - row.fetched_at;
  if (age > (row.status === 'found' ? FOUND_TTL : NONE_TTL)) return undefined;
  if (row.status === 'none') return null;
  try {
    return JSON.parse(row.payload ?? 'null') as LyricsResult;
  } catch {
    return undefined;
  }
}

function writeCache(trackId: number, result: LyricsResult | null): void {
  getDb().prepare(`
    INSERT INTO lyrics_cache (track_id, status, spotify_id, source, payload, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(track_id) DO UPDATE SET status = excluded.status, spotify_id = excluded.spotify_id,
      source = excluded.source, payload = excluded.payload, fetched_at = excluded.fetched_at
  `).run(
    trackId,
    result ? 'found' : 'none',
    result?.spotifyId ?? null,
    result?.source ?? null,
    result ? JSON.stringify(result) : null,
    Math.floor(Date.now() / 1000),
  );
}

/** Match the local track to a Spotify track and fetch its lyrics from Spicy Lyrics. */
async function onlineLyrics(track: TrackRow, key: string, refresh: boolean): Promise<LyricsResult | null> {
  if (!refresh) {
    const cached = readCache(track.id);
    if (cached !== undefined) return cached;
  }
  try {
    const title = cleanTitle(track.title || path.basename(track.file_path, path.extname(track.file_path)));
    const results = await searchTracks(key, {
      title,
      artist: track.artist ? primaryArtist(track.artist) : null,
      album: track.album,
      duration: track.duration,
    });
    const match = pickMatch(results, track.duration);
    if (!match) {
      writeCache(track.id, null);
      return null;
    }
    const result = toLyricsResult(await getLyrics(key, match.spotifyId));
    if (!result.lines && !result.plainText) {
      writeCache(track.id, null);
      return null;
    }
    writeCache(track.id, result);
    return result;
  } catch (err) {
    if (err instanceof SpicyError && err.status === 404) {
      writeCache(track.id, null); // The API has no lyrics for this track.
    } else {
      // Offline, rate-limited, bad key…: say nothing is cached so we retry next time.
      console.warn(`[lyrics] Spicy Lyrics lookup failed for track ${track.id}: ${err instanceof Error ? err.message : err}`);
    }
    return null;
  }
}

const inflight = new Map<number, Promise<LyricsResult | null>>();

/**
 * Lyrics for a track, best source first:
 *   1. time-synced lyrics the user has locally (.ttml, .lrc, or embedded tags)
 *   2. Spicy Lyrics, when an API key is configured (cached)
 *   3. plain-text lyrics the user has locally (.txt or embedded)
 */
export function getLyricsForTrack(track: TrackRow, opts: { refresh?: boolean } = {}): Promise<LyricsResult | null> {
  const running = inflight.get(track.id);
  if (running) return running;
  const p = (async () => {
    const local = await readLocalLyrics(track.file_path);
    if (local.synced) return local.synced;
    const key = getSpicyKey();
    if (key) {
      const online = await onlineLyrics(track, key, opts.refresh === true);
      if (online) return online;
    }
    return local.unsynced;
  })().finally(() => inflight.delete(track.id));
  inflight.set(track.id, p);
  return p;
}
