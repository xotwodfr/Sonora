import fs from 'node:fs';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import { parseLrc } from './lrc.js';
import { parseTtml } from './ttml.js';
import type { LyricsResult } from './types.js';

/** Decode a lyrics file: honours UTF-8 / UTF-16 byte-order marks. */
export function decodeText(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8');
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  return buf.toString('utf8');
}

type SidecarKind = 'ttml' | 'lrc' | 'txt';

/** Find `<track>.ttml|lrc|txt` next to the audio file, ignoring case of name and extension. */
async function findSidecars(audioPath: string): Promise<Partial<Record<SidecarKind, string>>> {
  const dir = path.dirname(audioPath);
  const base = path.basename(audioPath, path.extname(audioPath)).toLowerCase();
  const found: Partial<Record<SidecarKind, string>> = {};
  let names: string[];
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return found;
  }
  for (const name of names) {
    const ext = path.extname(name).slice(1).toLowerCase();
    if (ext !== 'ttml' && ext !== 'lrc' && ext !== 'txt') continue;
    if (path.basename(name, path.extname(name)).toLowerCase() !== base) continue;
    found[ext] = path.join(dir, name);
  }
  return found;
}

async function readText(file: string): Promise<string | null> {
  try {
    return decodeText(await fs.promises.readFile(file)).trim() || null;
  } catch {
    return null;
  }
}

/** Interpret a lyrics string of unknown format (TTML, LRC or plain text). */
export function interpretLyricsText(text: string, source: LyricsResult['source']): LyricsResult | null {
  const body = text.trim();
  if (!body) return null;
  if (/^(?:<\?xml[^>]*\?>\s*)?<tt[\s>]/i.test(body)) {
    const t = parseTtml(body);
    if (t.lines.length === 0) return null;
    return t.synced
      ? { synced: true, lines: t.lines, plainText: null, source }
      : { synced: false, lines: null, plainText: t.lines.map((l) => l.text).join('\n'), source };
  }
  const lrc = parseLrc(body);
  if (lrc.length > 0) return { synced: true, lines: lrc, plainText: null, source };
  return { synced: false, lines: null, plainText: body, source };
}

export interface LocalLyrics {
  /** Time-synced lyrics from a sidecar or the file's tags, best first. */
  synced: LyricsResult | null;
  /** Plain-text lyrics, used when nothing better is available. */
  unsynced: LyricsResult | null;
}

/** Lyrics the user already has: .ttml / .lrc / .txt next to the track, or embedded in its tags. */
export async function readLocalLyrics(audioPath: string): Promise<LocalLyrics> {
  let synced: LyricsResult | null = null;
  let unsynced: LyricsResult | null = null;
  const keep = (r: LyricsResult | null) => {
    if (!r) return;
    if (r.synced) synced ??= r;
    else unsynced ??= r;
  };

  const sidecars = await findSidecars(audioPath);
  if (sidecars.ttml) {
    const text = await readText(sidecars.ttml);
    if (text) keep(interpretLyricsText(text, 'sidecar-ttml'));
  }
  if (sidecars.lrc) {
    const text = await readText(sidecars.lrc);
    if (text) keep(interpretLyricsText(text, 'sidecar-lrc'));
  }
  if (sidecars.txt) {
    const text = await readText(sidecars.txt);
    // A .txt that is really LRC/TTML still works; plain text is the usual case.
    if (text) keep(interpretLyricsText(text, 'sidecar-txt'));
  }

  if (!synced || !unsynced) {
    try {
      const meta = await parseFile(audioPath, { skipCovers: true, duration: false });
      const tags = (meta.common as unknown as Record<string, unknown>).lyrics as
        | Array<{ text?: string; syncText?: Array<{ text: string; timestamp?: number }> }>
        | undefined;
      for (const tag of tags ?? []) {
        if (Array.isArray(tag.syncText) && tag.syncText.length > 0) {
          const lines = tag.syncText
            .map((s) => ({ time: typeof s.timestamp === 'number' ? s.timestamp / 1000 : 0, text: s.text ?? '' }))
            .filter((l) => l.text.length > 0);
          if (lines.length > 0) keep({ synced: true, lines, plainText: null, source: 'embedded' });
        }
        if (typeof tag.text === 'string') keep(interpretLyricsText(tag.text, 'embedded'));
      }
    } catch {
      // Unreadable file or tags: sidecars (if any) are all we have.
    }
  }

  return { synced, unsynced };
}
