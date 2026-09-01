import express from 'express';
import cors from 'cors';

import libraryRoutes from './routes/library.js';
import trackRoutes from './routes/tracks.js';
import albumRoutes from './routes/albums.js';
import artistRoutes from './routes/artists.js';
import genreRoutes from './routes/genres.js';
import playlistRoutes from './routes/playlists.js';
import favoriteRoutes from './routes/favorites.js';
import recentlyPlayedRoutes from './routes/recentlyPlayed.js';
import searchRoutes from './routes/search.js';

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
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

  // 404 for unknown API routes.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  return app;
}
