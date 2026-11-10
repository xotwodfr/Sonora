import { Router } from 'express';
import config from '../config.js';
import { asyncHandler, badRequest, ok } from '../api/helpers.js';
import { getSpicyKey, setMusicPath, setSpicyKey } from '../settings.js';
import { isScanning, scanLibrary } from '../scanner/scanner.js';
import { SpicyError, searchTracks } from '../lyrics/spicy.js';

const router = Router();

/** The settings the UI may see. The API key itself is never sent back, only a hint. */
function view() {
  const key = getSpicyKey();
  return {
    musicPath: config.musicPath || null,
    /** True when running inside the desktop app (native folder picker available). */
    desktop: process.env.SONORA_DESKTOP === '1',
    spicyLyrics: { configured: !!key, hint: key ? `…${key.slice(-4)}` : null },
  };
}

/** GET /api/settings */
router.get('/', (_req, res) => ok(res, view()));

/** PUT /api/settings — { musicPath?: string, spicyLyricsKey?: string | null } */
router.put('/', (req, res) => {
  const { musicPath, spicyLyricsKey } = (req.body ?? {}) as { musicPath?: unknown; spicyLyricsKey?: unknown };

  if (spicyLyricsKey !== undefined) {
    if (spicyLyricsKey !== null && typeof spicyLyricsKey !== 'string') return badRequest(res, 'spicyLyricsKey must be a string');
    const key = (spicyLyricsKey ?? '').trim();
    if (key.length > 300 || /\s/.test(key)) return badRequest(res, 'That does not look like an API key');
    setSpicyKey(key || null);
  }

  if (musicPath !== undefined) {
    if (typeof musicPath !== 'string' || !musicPath.trim()) return badRequest(res, 'musicPath must be a folder path');
    try {
      setMusicPath(musicPath);
    } catch (err) {
      return badRequest(res, err instanceof Error ? err.message : 'Invalid folder');
    }
    if (!isScanning()) void scanLibrary();
  }

  return ok(res, view());
});

/**
 * POST /api/settings/spicy-lyrics/test — { key?: string }
 * Checks a key (the one in the body, else the saved one) with a single search.
 */
router.post('/spicy-lyrics/test', asyncHandler(async (req, res) => {
  const bodyKey = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
  const key = bodyKey || getSpicyKey();
  if (!key) return badRequest(res, 'No API key to test');
  try {
    await searchTracks(key, { title: 'Never Gonna Give You Up', artist: 'Rick Astley', duration: 213.573 });
    return ok(res, { ok: true });
  } catch (err) {
    if (err instanceof SpicyError) {
      const rejected = err.status === 401 || err.status === 403;
      return ok(res, {
        ok: false,
        error: rejected
          ? 'Spicy Lyrics rejected this key.'
          : err.status === 429
            ? 'Rate limited by Spicy Lyrics; try again shortly.'
            : err.status === 0
              ? `Could not reach Spicy Lyrics (${err.message}).`
              : err.message,
        code: err.code ?? null,
      });
    }
    throw err;
  }
}));

export default router;
