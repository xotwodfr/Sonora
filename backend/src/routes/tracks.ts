import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/index.js';
import { getTrack } from '../db/library.js';
import { getLyricsForTrack } from '../lyrics/service.js';
import { parsePaging, parseSort, sendPaged, ok, notFound, asyncHandler } from '../api/helpers.js';

const router = Router();

const BASE_WHERE = 'tracks t LEFT JOIN artists a ON a.id = t.artist_id LEFT JOIN albums al ON al.id = t.album_id LEFT JOIN genres g ON g.id = t.genre_id';
const SELECT = `
  SELECT t.id, t.file_path, t.title, a.name AS artist, t.artist_id,
         al.title AS album, t.album_id, g.name AS genre, t.genre_id,
         t.track_number, t.disc_number, t.year, t.composer, t.duration,
         t.bitrate, t.sample_rate, t.bit_depth, t.codec, t.has_artwork,
         t.has_lyrics, al.artwork_path AS album_artwork,
         (f.track_id IS NOT NULL) AS favorite, t.added_at, t.modified_at
  FROM ${BASE_WHERE}
  LEFT JOIN favorites f ON f.track_id = t.id
`;

/** Shared WHERE builder used across track listing, favorites, and playlists. */
export function trackWhere(opts: {
  artistId?: number | null;
  albumId?: number | null;
  genreId?: number | null;
  favorite?: boolean;
  search?: string;
  ids?: number[];
}): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (opts.artistId !== undefined && opts.artistId !== null) {
    clauses.push('t.artist_id = ?'); params.push(opts.artistId);
  }
  if (opts.albumId !== undefined && opts.albumId !== null) {
    clauses.push('t.album_id = ?'); params.push(opts.albumId);
  }
  if (opts.genreId !== undefined && opts.genreId !== null) {
    clauses.push('t.genre_id = ?'); params.push(opts.genreId);
  }
  if (opts.favorite) {
    clauses.push('f.track_id IS NOT NULL');
  }
  if (opts.search) {
    const like = `%${opts.search}%`;
    clauses.push('(t.title LIKE ? COLLATE NOCASE OR a.name LIKE ? COLLATE NOCASE OR al.title LIKE ? COLLATE NOCASE)');
    params.push(like, like, like);
  }
  if (opts.ids && opts.ids.length) {
    clauses.push(`t.id IN (${opts.ids.map(() => '?').join(',')})`);
    params.push(...opts.ids);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

/** GET /api/tracks — paginated, sortable, filterable. */
router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  const { page, limit, offset } = parsePaging(req.query);
  const sort = parseSort(req.query, ['title', 'artist', 'album', 'genre', 'year', 'duration', 'added_at', 'track_number'], {
    title: 't.title COLLATE NOCASE',
    artist: 'a.name COLLATE NOCASE',
    album: 'al.title COLLATE NOCASE',
    genre: 'g.name COLLATE NOCASE',
    year: 't.year',
    duration: 't.duration',
    added_at: 't.added_at',
    track_number: 't.track_number',
  });
  const q = req.query as Record<string, string>;

  const filters = trackWhere({
    artistId: q.artist ? Number(q.artist) : undefined,
    albumId: q.album ? Number(q.album) : undefined,
    genreId: q.genre ? Number(q.genre) : undefined,
    favorite: q.favorite === 'true' || q.favorite === '1',
    search: q.q,
  });

  const totalRow = db.prepare(`SELECT COUNT(*) AS c FROM tracks t ${filters.where}`).get(...filters.params) as { c: number };
  const rows = db.prepare(
    `${SELECT} ${filters.where} ORDER BY ${sort.col} ${sort.dir} LIMIT ? OFFSET ?`,
  ).all(...filters.params, limit, offset);
  return sendPaged(res, rows, totalRow.c, page, limit);
}));

/** POST /api/tracks/bulk - resolve a list of ids to full rows (for queue restore). */
router.post('/bulk', asyncHandler(async (req, res) => {
  const ids = (req.body?.ids ?? []) as number[];
  if (!Array.isArray(ids) || ids.length === 0) return ok(res, { data: [] });
  const { where, params } = trackWhere({ ids });
  const db = getDb();
  const rows = db.prepare(`${SELECT} ${where}`).all(...params);
  // Preserve request order.
  const byId = new Map((rows as Array<{ id: number }>).map((r) => [r.id, r]));
  return ok(res, { data: ids.map((id) => byId.get(id)).filter(Boolean) });
}));

/** GET /api/tracks/:id */
router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare(`${SELECT} WHERE t.id = ?`).get(id);
  if (!row) return notFound(res, 'Track not found');
  return ok(res, row);
}));

/** GET /api/tracks/:id/stream — range-aware audio streaming from the mounted library. */
router.get('/:id/stream', (req, res) => {
  const id = Number(req.params.id);
  const row = getTrack(id);
  if (!row || !row.file_path) {
    res.status(404).json({ error: 'Track not found' });
    return;
  }
  const filePath = row.file_path;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    res.status(404).json({ error: 'Audio file unavailable on disk' });
    return;
  }

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';

  const range = req.headers.range;
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match && match[1] ? parseInt(match[1], 10) : 0;
    const end = match && match[2]
      ? parseInt(match[2], 10)
      : Math.min(start + 1024 * 1024 * 4 - 1, stat.size - 1);
    if (start >= stat.size || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
      return;
    }
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Content-Type', mime);
    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    res.setHeader('Content-Type', mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
  }
});

/** GET /api/tracks/:id/artwork — cached embedded artwork for a track. */
router.get('/:id/artwork', (req, res) => {
  const id = Number(req.params.id);
  const row = getTrack(id);
  // Resolve album artwork (which may have been written during a scan).
  const albumArt = row?.album_artwork ?? (row?.album_id
    ? (getDb().prepare('SELECT artwork_path FROM albums WHERE id = ?').get(row.album_id) as { artwork_path: string | null } | undefined)?.artwork_path ?? null
    : null);

  const cand = albumArt ?? row?.album_artwork ?? null;
  if (!cand) {
    res.status(404).json({ error: 'No artwork' });
    return;
  }
  const mime = extToMime(path.extname(cand).slice(1));
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  fs.createReadStream(cand).pipe(res);
});

/** PUT /api/tracks/:id/favorite */
router.put('/:id/favorite', (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const exists = db.prepare('SELECT id FROM tracks WHERE id = ?').get(id);
  if (!exists) return notFound(res);
  db.prepare('INSERT OR IGNORE INTO favorites (track_id) VALUES (?)').run(id);
  return ok(res, { id, favorite: true });
});

/** DELETE /api/tracks/:id/favorite */
router.delete('/:id/favorite', (req, res) => {
  const id = Number(req.params.id);
  getDb().prepare('DELETE FROM favorites WHERE track_id = ?').run(id);
  return ok(res, { id, favorite: false });
});

/**
 * GET /api/tracks/:id/lyrics — lyrics for a track (local .ttml/.lrc/.txt or
 * embedded, else Spicy Lyrics when a key is set). ?refresh=1 skips the cache.
 */
router.get('/:id/lyrics', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const row = getTrack(id);
  if (!row || !row.file_path) return notFound(res, 'Track not found');
  const lyrics = await getLyricsForTrack(row, { refresh: req.query.refresh === '1' });
  return ok(res, lyrics);
}));

const MIME_BY_EXT: Record<string, string> = {
  flac: 'audio/flac',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  mp4: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  aiff: 'audio/aiff',
  aif: 'audio/aiff',
  wma: 'audio/x-ms-wma',
};

function extToMime(ext: string): string {
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

export default router;
