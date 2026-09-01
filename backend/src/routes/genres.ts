import { Router } from 'express';
import { getDb } from '../db/index.js';
import { parseSort, sendPaged, ok } from '../api/helpers.js';

const router = Router();

/** GET /api/genres */
router.get('/', (req, res) => {
  const db = getDb();
  const sort = parseSort(req.query, ['name']);
  const rows = db.prepare(`
    SELECT g.id, g.name,
           (SELECT COUNT(*) FROM tracks t WHERE t.genre_id = g.id) AS track_count,
           (SELECT COUNT(DISTINCT t.album_id) FROM tracks t WHERE t.genre_id = g.id AND t.album_id IS NOT NULL) AS album_count
    FROM genres g
    ORDER BY g.name COLLATE NOCASE ${sort.dir}
  `).all();
  return sendPaged(res, rows, rows.length, 1, rows.length);
});

/** GET /api/genres/:id — genre detail + tracks. */
router.get('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const genre = db.prepare('SELECT id, name FROM genres WHERE id = ?').get(id);
  if (!genre) return res.status(404).json({ error: 'Genre not found' });

  const tracks = db.prepare(`
    SELECT t.id, t.title, a.name AS artist, al.title AS album, t.duration, t.year,
           (f.track_id IS NOT NULL) AS favorite
    FROM tracks t
    LEFT JOIN artists a ON a.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
    LEFT JOIN favorites f ON f.track_id = t.id
    WHERE t.genre_id = ?
    ORDER BY t.year DESC, t.title COLLATE NOCASE
  `).all(id);

  const albums = db.prepare(`
    SELECT al.id, al.title, al.year, al.artwork_path
    FROM album_genres ag
    JOIN albums al ON al.id = ag.album_id
    WHERE ag.genre_id = ?
    ORDER BY COALESCE(al.year, 9999) DESC
  `).all(id);

  return ok(res, { ...genre, tracks, albums });
});

export default router;
