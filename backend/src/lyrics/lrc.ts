import type { LyricLine } from './types.js';

const TIME_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TAG = /<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g;

/**
 * Parse LRC lyrics into timed lines.
 *
 * Handles [mm:ss.xx] / [mm:ss.xxx] / [mm:ss] stamps, several stamps on one
 * line, the [offset:+/-ms] header, and "enhanced" LRC: the per-word <mm:ss.xx>
 * tags are dropped, so those files play back line-synced. Metadata headers
 * ([ar:], [ti:] …) carry no time and are skipped.
 */
export function parseLrc(content: string): LyricLine[] {
  const offsetMatch = /\[offset:\s*([+-]?\d+)\s*\]/i.exec(content);
  const offset = offsetMatch ? parseInt(offsetMatch[1], 10) / 1000 : 0;

  const lines: LyricLine[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const times: number[] = [];
    TIME_TAG.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TIME_TAG.exec(raw)) !== null) {
      const frac = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) / 1000 : 0;
      times.push(parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac);
    }
    if (times.length === 0) continue;
    const text = raw.replace(TIME_TAG, '').replace(WORD_TAG, '').replace(/\s+/g, ' ').trim();
    for (const t of times) lines.push({ time: Math.max(0, t - offset), text });
  }

  lines.sort((a, b) => a.time - b.time);
  // A line ends where the next one starts; used for fill/transition timing.
  for (let i = 0; i < lines.length - 1; i++) lines[i].end = lines[i + 1].time;
  return lines;
}
