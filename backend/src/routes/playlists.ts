import { Router } from 'express';
import { getDb } from '../db/index.js';
import { ok, notFound, badRequest } from '../api/helpers.js';

const router = Router();

/** GET /api/playlists */
router.get('/', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
           (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS track_count
    FROM playlists p
    ORDER BY p.name COLLATE NOCASE
  `).all();
  return ok(res, rows);
});

/** POST /api/playlists */
router.post('/', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return badRequest(res, 'Playlist name is required');
  const db = getDb();
  const info = db.prepare('INSERT INTO playlists (name, description) VALUES (?, ?)')
    .run(name, req.body?.description ?? null);
  const row = db.prepare('SELECT * FROM playlists WHERE id = ?').get(Number(info.lastInsertRowid));
  return ok(res, row);
});

/** PUT /api/playlists/:id — rename/reorder. */
router.put('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const exists = db.prepare('SELECT id FROM playlists WHERE id = ?').get(id);
  if (!exists) return notFound(res, 'Playlist not found');

  if (req.body?.name !== undefined) {
    db.prepare('UPDATE playlists SET name = ?, updated_at = strftime(\'%s\',\'now\') WHERE id = ?')
      .run(String(req.body.name).trim(), id);
  }
  if (req.body?.description !== undefined) {
    db.prepare('UPDATE playlists SET description = ?, updated_at = strftime(\'%s\',\'now\') WHERE id = ?')
      .run(req.body.description, id);
  }
  // Optional reorder: body.positions = [trackId, ...] => rewrite positions.
  if (Array.isArray(req.body?.positions)) {
    const positions = req.body.positions as number[];
    const tx = db.transaction((list: number[]) => {
      db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(id);
      const insert = db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)');
      list.forEach((trackId, idx) => insert.run(id, trackId, idx + 1));
    });
    tx(positions);
  }

  const row = db.prepare(`
    SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
           (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS track_count
    FROM playlists p WHERE p.id = ?
  `).get(id);
  return ok(res, row);
});

/** DELETE /api/playlists/:id */
router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
  return ok(res, { id, deleted: true });
});

/** GET /api/playlists/:id — playlist + tracks. */
router.get('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const playlist = db.prepare(`
    SELECT p.id, p.name, p.description, p.created_at, p.updated_at
    FROM playlists p WHERE p.id = ?
  `).get(id);
  if (!playlist) return notFound(res, 'Playlist not found');

  const tracks = db.prepare(`
    SELECT t.id, t.title, a.name AS artist, al.title AS album, t.duration, t.year,
           t.track_number, t.has_artwork, al.artwork_path AS album_artwork,
           (f.track_id IS NOT NULL) AS favorite, pt.position
    FROM playlist_tracks pt
    JOIN tracks t ON t.id = pt.track_id
    LEFT JOIN artists a ON a.id = t.artist_id
    LEFT JOIN albums al ON al.id = t.album_id
    LEFT JOIN favorites f ON f.track_id = t.id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position
  `).all(id);

  return ok(res, { ...playlist, track_count: tracks.length, tracks });
});

/** POST /api/playlists/:id/tracks — add tracks (body: { trackIds: number[] }) */
router.post('/:id/tracks', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM playlists WHERE id = ?').get(id);
  if (!existing) return notFound(res, 'Playlist not found');

  const ids = Array.isArray(req.body?.trackIds) ? req.body.trackIds as number[] : [];
  if (ids.length === 0) return badRequest(res, 'trackIds required');

  const maxPos = (db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM playlist_tracks WHERE playlist_id = ?')
    .get(id) as { m: number }).m;
  const insert = db.prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)');
  const tx = db.transaction((list: number[]) => {
    list.forEach((trackId, i) => {
      // Only insert if not already in the playlist.
      const dup = db.prepare('SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
        .get(id, trackId);
      if (!dup) insert.run(id, trackId, maxPos + i + 1);
    });
    db.prepare('UPDATE playlists SET updated_at = strftime(\'%s\',\'now\') WHERE id = ?').run(id);
  });
  tx(ids);
  return ok(res, { added: ids.length });
});

/** DELETE /api/playlists/:id/tracks/:trackId */
router.delete('/:id/tracks/:trackId', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const trackId = Number(req.params.trackId);
  db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(id, trackId);
  // Renumber remaining positions to keep them contiguous.
  const rows = db.prepare('SELECT id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position')
    .all(id) as Array<{ id: number }>;
  const renumber = db.transaction((list: Array<{ id: number }>) => {
    const stmt = db.prepare('UPDATE playlist_tracks SET position = ? WHERE id = ?');
    list.forEach((r, i) => stmt.run(i + 1, r.id));
  });
  renumber(rows);
  db.prepare('UPDATE playlists SET updated_at = strftime(\'%s\',\'now\') WHERE id = ?').run(id);
  return ok(res, { id, trackId, removed: true });
});

export default router;
