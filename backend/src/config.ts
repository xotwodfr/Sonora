import path from 'node:path';
import fs from 'node:fs';

/**
 * Central runtime configuration for the Sonora backend.
 * Every path is overridable through environment variables so the same image
 * works in Docker (defaults), Electron (user-controlled DATA_PATH), and tests.
 */

export interface Config {
  port: number;
  /** Absolute path to the mounted (read-only) music library. */
  musicPath: string;
  /** Writable directory for the database, artwork cache, and app data. */
  dataPath: string;
  dbPath: string;
  artworkPath: string;
  /** Filesystem path that maps the library root — used only for display. */
  hostname: string;
}

function resolveDir(envVar: string, fallback: string): string {
  const v = process.env[envVar];
  return v && v.length > 0 ? path.resolve(v) : fallback;
}

function makeConfig(): Config {
  const dataPath = resolveDir('DATA_PATH', '/data');
  const artworkPath = path.join(dataPath, 'artwork-cache');

  // Ensure writable directories exist.
  fs.mkdirSync(dataPath, { recursive: true });
  fs.mkdirSync(artworkPath, { recursive: true });

  return {
    port: parseInt(process.env.PORT ?? '8787', 10),
    musicPath: resolveDir('MUSIC_PATH', '/music'),
    dataPath,
    dbPath: path.join(dataPath, 'sonora.db'),
    artworkPath,
    hostname: process.env.HOSTNAME ?? 'sonora',
  };
}

const config = makeConfig();

export default config;
