import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Sonora frontend build.
 *
 * - Dev: `vite` proxies /api to the backend at BACKEND_URL (default
 *   http://localhost:8787) so the browser hits same-origin /api.
 * - Prod/Electron/Capacitor: the API base defaults to same-origin `/api` and
 *   can be overridden at build/runtime via VITE_API_BASE so the same bundle
 *   points anywhere (an embedded local backend, etc.).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:8787',
        changeOrigin: true,
      },
      // Artwork/audio served from the backend under /api already; no extra rule.
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
