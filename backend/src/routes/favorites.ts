import { Router } from 'express';
import { getDb } from '../db/index.js';
import { parsePaging, parseSort, sendPaged } from '../api/helpers.js';

const router = Router();

/** GET /api/favorites — favorite tracks. */
router.get('/', (req, res) => {
  const db = getDb();
  const { page, limit, offset } = parsePaging(req.query);
  const sort = parseSort(req.query, ['title', 'artist', 'album', 'duration', 'added_at'], {
    title: 't.title COLLATE NOCASE',
    artist: 'a.name COLLATE NOCASE',
    album: 'al.title COLLATE NOCASE',
    duration: 't.duration',
    added_at: 'f.created_at',
  });
  const totalRow = db.prepare(`
    SELECT COUNT(*) AS c FROM favorites f JOIN tracks t ON t.id = f.track_id
  `).get() as { c: number };

  const rows = db.prepare(`
    SELECT t.id, t.title, a.name AS artist, al.title AS album, t.duration, t.year,
           t.has_artwork, al.artwork_path AS album_artwork,
           1 AS favorite, f.created_at AS added_at
    FROM favorites f
    JOIN tracks t ON t.id = f.track_id
    LEFT JOIN artists a ON a.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
    ORDER BY ${sort.col} ${sort.dir}
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  return sendPaged(res, rows, totalRow.c, page, limit);
});

export default router;
