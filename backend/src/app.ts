import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';

import libraryRoutes from './routes/library.js';
import trackRoutes from './routes/tracks.js';
import albumRoutes from './routes/albums.js';
import artistRoutes from './routes/artists.js';
import genreRoutes from './routes/genres.js';
import playlistRoutes from './routes/playlists.js';
import favoriteRoutes from './routes/favorites.js';
import recentlyPlayedRoutes from './routes/recentlyPlayed.js';
import searchRoutes from './routes/search.js';
import settingsRoutes from './routes/settings.js';
import { localOnlyGuard } from './security.js';

export interface AppOptions {
  /** Built frontend to serve at / (the desktop app). Omit when nginx serves it. */
  staticDir?: string;
  /** Desktop mode: loopback-only guards, no CORS. Needs the listening port. */
  desktopPort?: () => number;
}

export function createApp(opts: AppOptions = {}): express.Express {
  const app = express();
  if (opts.desktopPort) app.use(localOnlyGuard(opts.desktopPort));
  else app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'sonora-backend' }));

  app.use('/api/library', libraryRoutes);
  app.use('/api/tracks', trackRoutes);
  app.use('/api/albums', albumRoutes);
  app.use('/api/artists', artistRoutes);
  app.use('/api/genres', genreRoutes);
  app.use('/api/playlists', playlistRoutes);
  app.use('/api/favorites', favoriteRoutes);
  app.use('/api/recently-played', recentlyPlayedRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/settings', settingsRoutes);

  // 404 for unknown API routes.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  if (opts.staticDir && fs.existsSync(path.join(opts.staticDir, 'index.html'))) {
    const dir = opts.staticDir;
    app.use(express.static(dir, { index: 'index.html' }));
    // Single-page app: any other GET goes to the router in index.html.
    app.get('*', (_req, res) => res.sendFile(path.join(dir, 'index.html')));
  }

  return app;
}
