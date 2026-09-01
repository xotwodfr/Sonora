import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ok } from '../api/helpers.js';

const router = Router();

/**
 * GET /api/search?q=... — grouped results across tracks, albums, artists,
 * genres, and playlists. Limits keep payloads small for fast typing.
 */
router.get('/', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return ok(res, { query: '', results: {} });

  const db = getDb();
  const like = `%${q}%`;

  const tracks = db.prepare(`
    SELECT t.id, t.title, a.name AS artist, al.title AS album, t.duration, t.year,
           t.has_artwork, al.artwork_path AS album_artwork,
           (f.track_id IS NOT NULL) AS favorite
    FROM tracks t
    LEFT JOIN artists a ON a.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
    LEFT JOIN favorites f ON f.track_id = t.id
    WHERE t.title LIKE ? COLLATE NOCASE OR a.name LIKE ? COLLATE NOCASE OR al.title LIKE ? COLLATE NOCASE
    LIMIT 30
  `).all(like, like, like);

  const albums = db.prepare(`
    SELECT al.id, al.title, al.album_artist, al.year, al.artwork_path,
           (SELECT COUNT(*) FROM tracks t WHERE t.album_id = al.id) AS track_count
    FROM albums al
    WHERE al.title LIKE ? COLLATE NOCASE
    LIMIT 15
  `).all(like);

  const artists = db.prepare(`
    SELECT a.id, a.name, a.artwork_path FROM artists a
    WHERE a.name LIKE ? COLLATE NOCASE
    LIMIT 15
  `).all(like);

  const genres = db.prepare(`
    SELECT g.id, g.name FROM genres g
    WHERE g.name LIKE ? COLLATE NOCASE
    LIMIT 10
  `).all(like);

  const playlists = db.prepare(`
    SELECT p.id, p.name FROM playlists p
    WHERE p.name LIKE ? COLLATE NOCASE
    LIMIT 10
  `).all(like);

  return ok(res, {
    query: q,
    results: {
      tracks,
      albums,
      artists,
      genres,
      playlists,
    },
  });
});

export default router;
