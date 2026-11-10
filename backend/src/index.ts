import config from './config.js';
import { startServer } from './server.js';

const running = await startServer({ host: '0.0.0.0' });

console.log(`[sonora] backend listening on http://0.0.0.0:${running.port}`);
console.log(`[sonora] music path : ${config.musicPath || '(not set)'}`);
console.log(`[sonora] data  path : ${config.dataPath}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    running.close().then(() => process.exit(0));
  });
}
