import getDb from './index.js';
import type { Database } from 'better-sqlite3';

/**
 * Library repository — all SQL that reads/writes the music catalogue.
 * Kept separate from HTTP routing so business logic stays query-focused.
 */

export interface TrackRow {
  id: number;
  file_path: string;
  title: string | null;
  artist: string | null;
  artist_id: number | null;
  album: string | null;
  album_id: number | null;
  genre: string | null;
  genre_id: number | null;
  album_artist: string | null;
  track_number: number | null;
  disc_number: number | null;
  year: number | null;
  composer: string | null;
  duration: number | null;
  bitrate: number | null;
  sample_rate: number | null;
  bit_depth: number | null;
  codec: string | null;
  has_artwork: number;
  has_lyrics: number;
  album_artwork: string | null;
  favorite: number;
  added_at: number;
  modified_at: number;
}

const TRACK_SELECT = `
  SELECT
    t.id,
    t.file_path,
    t.title,
    a.name AS artist,
    t.artist_id,
    al.title AS album,
    t.album_id,
    g.name AS genre,
    t.genre_id,
    al.album_artist,
    t.track_number,
    t.disc_number,
    t.year,
    t.composer,
    t.duration,
    t.bitrate,
    t.sample_rate,
    t.bit_depth,
    t.codec,
    t.has_artwork,
    t.has_lyrics,
    al.artwork_path AS album_artwork,
    CASE WHEN f.track_id IS NOT NULL THEN 1 ELSE 0 END AS favorite,
    t.added_at,
    t.modified_at
  FROM tracks t
  LEFT JOIN artists a ON a.id = t.artist_id
  LEFT JOIN albums al ON al.id = t.album_id
  LEFT JOIN genres g ON g.id = t.genre_id
  LEFT JOIN favorites f ON f.track_id = t.id
`;

// ---- Tracks ----

export function getTrack(id: number): TrackRow | undefined {
  const row = getDb().prepare(`${TRACK_SELECT} WHERE t.id = ?`).get(id) as TrackRow | undefined;
  return row;
}

export function getTracksByFilePaths(paths: string[]): Map<string, number> {
  const map = new Map<string, number>();
  if (paths.length === 0) return map;
  // better-sqlite3 supports binding arrays for IN clauses.
  const rows = getDb().prepare(
    `SELECT id, file_path FROM tracks WHERE file_path IN (${paths.map(() => '?').join(',')})`,
  ).all(...paths) as Array<{ id: number; file_path: string }>;
  for (const r of rows) map.set(r.file_path, r.id);
  return map;
}

// ---- Artist/Album/Genre resolution for scan ----

export function findOrCreateArtist(name: string): number {
  const normalized = name.trim().toLowerCase();
  const existing = getDb().prepare('SELECT id, name FROM artists WHERE normalized = ?')
    .get(normalized) as { id: number; name: string } | undefined;
  if (existing) return existing.id;
  const info = getDb().prepare(
    'INSERT INTO artists (name, sort_name, normalized) VALUES (?, ?, ?)',
  ).run(name.trim(), name.trim(), normalized);
  return Number(info.lastInsertRowid);
}

export function findOrCreateAlbum(opts: {
  title: string;
  artistId: number | null;
  albumArtist: string | null;
  year: number | null;
  totalTracks: number | null;
  totalDiscs: number | null;
  artworkPath: string | null;
}): number {
  const normalized = opts.title.trim().toLowerCase();
  // Match on (normalized title, album_artist). Trackless albums match on title alone.
  let row = getDb().prepare(
    `SELECT id FROM albums WHERE normalized = ? AND (album_artist IS ? OR album_artist = ?)`,
  ).get(normalized, opts.albumArtist, opts.albumArtist) as { id: number } | undefined;

  if (!row) {
    const info = getDb().prepare(
      `INSERT INTO albums (title, artist_id, album_artist, year, total_tracks, total_discs, artwork_path, normalized)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      opts.title.trim(),
      opts.artistId,
      opts.albumArtist,
      opts.year,
      opts.totalTracks,
      opts.totalDiscs,
      opts.artworkPath,
      normalized,
    );
    return Number(info.lastInsertRowid);
  }
  return row.id;
}

export function findOrCreateGenre(name: string): number {
  let row = getDb().prepare('SELECT id FROM genres WHERE name = ? COLLATE NOCASE').get(name.trim()) as
    | { id: number }
    | undefined;
  if (row) return row.id;
  const info = getDb().prepare('INSERT INTO genres (name) VALUES (?)').run(name.trim());
  return Number(info.lastInsertRowid);
}

// ---- Scan bookkeeping ----

export function getAllFilePaths(): string[] {
  const rows = getDb().prepare('SELECT file_path FROM tracks').all() as Array<{ file_path: string }>;
  return rows.map((r) => r.file_path);
}

export function insertTrack(data: Record<string, unknown>): number {
  const info = getDb().prepare(
    `INSERT INTO tracks (
       file_path, file_name, file_ext, file_size, mtime_ms, title,
       artist_id, album_id, genre_id, track_number, disc_number, year,
       composer, duration, bitrate, sample_rate, bit_depth, codec,
       has_artwork, has_lyrics, normalized, content_hash, added_at, modified_at
     ) VALUES (
       @file_path, @file_name, @file_ext, @file_size, @mtime_ms, @title,
       @artist_id, @album_id, @genre_id, @track_number, @disc_number, @year,
       @composer, @duration, @bitrate, @sample_rate, @bit_depth, @codec,
       @has_artwork, @has_lyrics, @normalized, @content_hash,
       strftime('%s','now'), strftime('%s','now')
     )`,
  ).run(data);
  return Number(info.lastInsertRowid);
}

export function updateTrack(id: number, data: Record<string, unknown>): void {
  const allowed = [
    'file_name', 'file_ext', 'file_size', 'mtime_ms', 'title',
    'artist_id', 'album_id', 'genre_id', 'track_number', 'disc_number', 'year',
    'composer', 'duration', 'bitrate', 'sample_rate', 'bit_depth', 'codec',
    'has_artwork', 'has_lyrics', 'normalized', 'content_hash',
  ];
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in data) {
      sets.push(`${key} = ?`);
      values.push(data[key]);
    }
  }
  if (sets.length === 0) return;
  values.push(id);
  getDb().prepare(`UPDATE tracks SET ${sets.join(', ')}, modified_at = strftime('%s','now') WHERE id = ?`)
    .run(...values);
}

export function deleteTrack(id: number): void {
  getDb().prepare('DELETE FROM tracks WHERE id = ?').run(id);
}

export function countTracks(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS c FROM tracks').get() as { c: number };
  return row.c;
}

export function isTitleInUseElsewhere(title: string, excludePath: string): boolean {
  const row = getDb().prepare(
    'SELECT 1 FROM tracks WHERE title = ? COLLATE NOCASE AND file_path != ? LIMIT 1',
  ).get(title, excludePath);
  return !!row;
}

/** Detects likely duplicates: same title + artist already in the library. */
export function findDuplicate(title: string, artistName: string | null): { id: number; file_path: string } | undefined {
  const q = `
    SELECT t.id, t.file_path FROM tracks t
    JOIN artists a ON a.id = t.artist_id
    WHERE t.title = ? COLLATE NOCASE
      AND (a.name = ? COLLATE NOCASE)
    LIMIT 1
  `;
  // artistName null → match only title
  if (!artistName) {
    return getDb().prepare(
      'SELECT id, file_path FROM tracks WHERE title = ? COLLATE NOCASE LIMIT 1',
    ).get(title) as { id: number; file_path: string } | undefined;
  }
  return getDb().prepare(q).get(title, artistName) as { id: number; file_path: string } | undefined;
}

export type { Database };
