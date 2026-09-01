import { Router } from 'express';
import { getDb } from '../db/index.js';
import { scanLibrary, getScanProgress, isScanning } from '../scanner/scanner.js';
import { asyncHandler, ok } from '../api/helpers.js';
import config from '../config.js';

const router = Router();

/** GET /api/library/status — current library + scan state. */
router.get('/status', (_req, res) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM tracks) AS tracks,
      (SELECT COUNT(*) FROM albums) AS albums,
      (SELECT COUNT(*) FROM artists) AS artists,
      (SELECT COUNT(*) FROM genres) AS genres,
      (SELECT COUNT(*) FROM playlists) AS playlists,
      (SELECT COUNT(*) FROM favorites) AS favorites
  `).get() as Record<string, number>;
  return ok(res, {
    ...row,
    musicPath: config.musicPath,
    dataPath: config.dataPath,
    scan: getScanProgress(),
  });
});

/** POST /api/library/scan — start (or re-return status of) a scan. */
router.post('/scan', asyncHandler(async (_req, res) => {
  if (isScanning()) {
    return ok(res, { started: false, scan: getScanProgress() });
  }
  // Fire and forget; progress is polled via /status.
  const promise = scanLibrary();
  void promise;
  return ok(res, { started: true, scan: getScanProgress() });
}));

export default router;
