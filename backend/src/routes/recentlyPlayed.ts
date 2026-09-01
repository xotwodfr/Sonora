import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ok, notFound } from '../api/helpers.js';

const router = Router();

/** Record a play (called by the frontend when a track actually plays). */
router.post('/', (req, res) => {
  const db = getDb();
  const trackId = Number(req.body?.trackId);
  const now = Date.now();
  const exists = db.prepare('SELECT id FROM tracks WHERE id = ?').get(trackId);
  if (!exists) return notFound(res, 'Track not found');

  db.prepare('INSERT INTO play_history (track_id, played_at) VALUES (?, ?)').run(trackId, now);
  db.prepare(`
    INSERT INTO recently_played (track_id, played_at) VALUES (?, ?)
    ON CONFLICT(track_id) DO UPDATE SET played_at = excluded.played_at
  `).run(trackId, now);
  return ok(res, { recorded: true });
});

/** GET /api/recently-played */
router.get('/', (req, res) => {
  const db = getDb();
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
  const rows = db.prepare(`
    SELECT t.id, t.title, a.name AS artist, al.title AS album, t.duration, t.year,
           t.album_id, t.has_artwork, al.artwork_path AS album_artwork,
           (f.track_id IS NOT NULL) AS favorite, rp.played_at
    FROM recently_played rp
    JOIN tracks t ON t.id = rp.track_id
    LEFT JOIN artists a ON a.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
    LEFT JOIN favorites f ON f.track_id = t.id
    ORDER BY rp.played_at DESC
    LIMIT ?
  `).all(limit);
  return ok(res, rows);
});

export default router;
