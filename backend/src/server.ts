import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import config from './config.js';
import { createApp } from './app.js';
import { getDb } from './db/index.js';
import { loadPersistedSettings } from './settings.js';
import { isScanning, scanLibrary } from './scanner/scanner.js';

export interface StartOptions {
  /** 0 picks a free port. Defaults to config.port. */
  port?: number;
  host?: string;
  /** Serve this built frontend at / (desktop app). */
  staticDir?: string;
  /** Desktop mode: loopback guards instead of open CORS. */
  desktop?: boolean;
}

export interface RunningServer {
  port: number;
  close(): Promise<void>;
}

/** Start the API (and optionally the frontend) and kick off a library scan. */
export async function startServer(opts: StartOptions = {}): Promise<RunningServer> {
  getDb();
  loadPersistedSettings();

  let listeningPort = opts.port ?? config.port;
  const app = createApp({
    staticDir: opts.staticDir,
    desktopPort: opts.desktop ? () => listeningPort : undefined,
  });

  const server: Server = await new Promise((resolve, reject) => {
    const s = app.listen(opts.port ?? config.port, opts.host ?? '0.0.0.0', () => resolve(s));
    s.once('error', reject);
  });
  listeningPort = (server.address() as AddressInfo).port;

  // Idempotent and cheap: unchanged files are skipped. Nothing to do until a folder is chosen.
  setTimeout(() => {
    if (config.musicPath && !isScanning()) {
      console.log('[sonora] running initial library scan…');
      scanLibrary().then((p) => console.log(`[sonora] initial scan done → ${p.message}`));
    }
  }, 500);

  return {
    port: listeningPort,
    close: () => new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    }),
  };
}
