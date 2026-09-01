import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { parsePaging, parseSort, sendPaged, ok, notFound } from '../api/helpers.js';

const router = Router();

const SELECT = `
  SELECT al.id, al.title, al.album_artist, al.year, al.total_tracks, al.total_discs,
         al.artwork_path,
         (SELECT COUNT(*) FROM tracks t WHERE t.album_id = al.id) AS track_count,
         (SELECT COUNT(DISTINCT t.artist_id) FROM tracks t WHERE t.album_id = al.id AND t.artist_id IS NOT NULL) AS artist_count,
         (SELECT COALESCE(SUM(t.duration), 0) FROM tracks t WHERE t.album_id = al.id) AS total_duration
  FROM albums al
`;

/** GET /api/albums */
router.get('/', (req, res) => {
  const db = getDb();
  const { page, limit, offset } = parsePaging(req.query);
  const sort = parseSort(req.query, ['title', 'album', 'year', 'artist']);
  const q = req.query as Record<string, string>;

  let where = '';
  const params: unknown[] = [];
  if (q.artist) {
    where = ' WHERE al.id IN (SELECT DISTINCT album_id FROM tracks WHERE artist_id = ?)';
    params.push(Number(q.artist));
  }
  if (q.q) {
    const like = `%${q.q}%`;
    where = where ? `${where} AND al.title LIKE ? COLLATE NOCASE` : ' WHERE al.title LIKE ? COLLATE NOCASE';
    params.push(like);
  }

  const totalRow = db.prepare(`SELECT COUNT(*) AS c FROM albums al ${where}`).get(...params) as { c: number };
  const order = sort.col === 'title' ? 'al.title COLLATE NOCASE' : sort.col;
  const rows = db.prepare(`${SELECT} ${where} ORDER BY ${order} ${sort.dir} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  return sendPaged(res, rows, totalRow.c, page, limit);
});

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

/** GET /api/albums/:id/artwork — the album's cached artwork as an image. */
router.get('/:id/artwork', (req, res) => {
  const row = getDb().prepare('SELECT artwork_path FROM albums WHERE id = ?').get(Number(req.params.id)) as
    | { artwork_path: string | null }
    | undefined;
  if (!row?.artwork_path) {
    res.status(404).json({ error: 'No artwork' });
    return;
  }
  const mime = MIME_BY_EXT[path.extname(row.artwork_path).slice(1).toLowerCase()] ?? 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  fs.createReadStream(row.artwork_path).pipe(res);
});

/** GET /api/albums/:id — album + track listing. */
router.get('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const album = db.prepare(`${SELECT} WHERE al.id = ?`).get(id);
  if (!album) return notFound(res, 'Album not found');

  const tracks = db.prepare(`
    SELECT t.id, t.title, a.name AS artist, t.track_number, t.disc_number, t.duration,
           t.year, (f.track_id IS NOT NULL) AS favorite, t.has_artwork
    FROM tracks t
    LEFT JOIN artists a ON a.id = t.artist_id
    LEFT JOIN favorites f ON f.track_id = t.id
    WHERE t.album_id = ?
    ORDER BY COALESCE(t.disc_number, 1), COALESCE(t.track_number, 0), t.id
  `).all(id);

  return ok(res, { ...album, tracks });
});

export default router;
