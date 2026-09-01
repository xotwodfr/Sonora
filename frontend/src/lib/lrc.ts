/**
 * Parse standard LRC format lyrics into timed lines.
 *
 * Handles:
 * - Standard timestamps: [MM:SS.xx]
 * - Extended timestamps: [MM:SS.xxx]
 * - Multiple timestamps per line
 * - Metadata tags [ti:Title], [ar:Artist], etc. (skipped — no time value)
 * - Lines without timestamps (skipped)
 *
 * Returns lines sorted by time ascending.
 */
export function parseLrc(content: string): Array<{ time: number; text: string }> {
  const lines: Array<{ time: number; text: string }> = [];
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const raw of content.split('\n')) {
    const times: number[] = [];
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;

    while ((match = regex.exec(raw)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] ?? '0';
      const ms = parseInt(msStr.padEnd(3, '0'), 10);
      times.push(min * 60 + sec + ms / 1000);
    }

    if (times.length === 0) continue;

    const text = raw.replace(/\[\d{1,2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
    for (const time of times) {
      lines.push({ time, text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}
