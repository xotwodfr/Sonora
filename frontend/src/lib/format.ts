/** Formatting helpers shared across the UI. */

/** 247 → "4:07" (or "1:02:48" past an hour). */
export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec) || sec < 0) return '0:00';
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Total play-length of an album, e.g. "1 hr 12 min". */
export function formatLength(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds <= 0) return '';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} hr ${m > 0 ? `${m} min` : ''}`.trim();
}

/** Track count in a human phrase: 1214 → "1,214 songs". */
export function formatCount(n: number | null | undefined, noun = 'song'): string {
  if (n == null) return '';
  return `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}`;
}

/** Relative date for "Recently" surfaces, e.g. "3h ago", "Yesterday". */
export function formatRelativeTime(unixMs: number | null | undefined): string {
  if (!unixMs) return '';
  const now = Date.now();
  const diff = now - unixMs;
  if (diff < 0) return 'just now';
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(unixMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "Tuesday, January 4" */
export function formatDate(unixMs: number | null | undefined): string {
  if (!unixMs) return '';
  return new Date(unixMs).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** Year list from albums, e.g. 2024 or 2019–2021. */
export function yearRange(years: (number | null | undefined)[]): string {
  const nums = years.filter((y): y is number => y != null);
  if (nums.length === 0) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return min === max ? String(min) : `${min}–${max}`;
}