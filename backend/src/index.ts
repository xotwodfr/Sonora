import config from './config.js';
import { createApp } from './app.js';
import { getDb } from './db/index.js';
import { scanLibrary, isScanning } from './scanner/scanner.js';

// Ensure DB is initialized before serving.
getDb();

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[sonora] backend listening on http://0.0.0.0:${config.port}`);
  console.log(`[sonora] music path : ${config.musicPath}`);
  console.log(`[sonora] data  path : ${config.dataPath}`);
});

// Auto-scan at startup if the library is empty OR always (idempotent, cheap
// because unchanged files are skipped).
setTimeout(() => {
  if (!isScanning()) {
    console.log('[sonora] running initial library scan…');
    scanLibrary().then((p) => {
      console.log(`[sonora] initial scan done → ${p.message}`);
    });
  }
}, 500);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
