import { Router } from 'express';
import { getDb } from '../db/index.js';
import { parsePaging, parseSort, sendPaged, ok, notFound } from '../api/helpers.js';

const router = Router();

/** GET /api/artists */
router.get('/', (req, res) => {
  const db = getDb();
  const { page, limit, offset } = parsePaging(req.query);
  const sort = parseSort(req.query, ['name']);
  const q = req.query as Record<string, string>;

  let where = '';
  const params: unknown[] = [];
  if (q.q) {
    where = ' WHERE a.name LIKE ? COLLATE NOCASE';
    params.push(`%${q.q}%`);
  }

  const totalRow = db.prepare(`SELECT COUNT(*) AS c FROM artists a ${where}`).get(...params) as { c: number };
  const rows = db.prepare(`
    SELECT a.id, a.name, a.artwork_path,
           (SELECT COUNT(*) FROM tracks t WHERE t.artist_id = a.id) AS track_count,
           (SELECT COUNT(DISTINCT t.album_id) FROM tracks t WHERE t.artist_id = a.id AND t.album_id IS NOT NULL) AS album_count
    FROM artists a
    ${where}
    ORDER BY a.name COLLATE NOCASE ${sort.dir}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  return sendPaged(res, rows, totalRow.c, page, limit);
});

/** GET /api/artists/:id — artist detail + top songs + albums. */
router.get('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const artist = db.prepare(`
    SELECT a.id, a.name, a.artwork_path,
           (SELECT COUNT(*) FROM tracks t WHERE t.artist_id = a.id) AS track_count,
           (SELECT COUNT(DISTINCT t.album_id) FROM tracks t WHERE t.artist_id = a.id AND t.album_id IS NOT NULL) AS album_count
    FROM artists a WHERE a.id = ?
  `).get(id);
  if (!artist) return notFound(res, 'Artist not found');

  const albums = db.prepare(`
    SELECT al.id, al.title, al.year, al.artwork_path,
           (SELECT COUNT(*) FROM tracks t WHERE t.album_id = al.id) AS track_count
    FROM albums al
    WHERE al.id IN (SELECT DISTINCT album_id FROM tracks WHERE artist_id = ? AND album_id IS NOT NULL)
    ORDER BY COALESCE(al.year, 9999) ASC, al.title COLLATE NOCASE
  `).all(id);

  const topTracks = db.prepare(`
    SELECT t.id, t.title, al.title AS album, t.duration, t.track_number,
           (f.track_id IS NOT NULL) AS favorite
    FROM tracks t
    LEFT JOIN albums al ON al.id = t.album_id
    LEFT JOIN favorites f ON f.track_id = t.id
    WHERE t.artist_id = ?
    ORDER BY COALESCE(f.track_id, 0) DESC, t.duration ASC
    LIMIT 10
  `).all(id);

  return ok(res, { ...artist, albums, topTracks });
});

export default router;
