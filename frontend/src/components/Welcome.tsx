import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Music2 } from 'lucide-react';
import { api, type AppSettings } from '../lib/api';

/**
 * First-run screen: pick the music folder, then wait for the first scan.
 * In the desktop app the button opens the native folder dialog; in a plain
 * browser (dev) there is no dialog, so a path field is shown instead.
 */
export function Welcome({ settings, onReady }: { settings: AppSettings; onReady: () => void }) {
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ found: number; scanned: number } | null>(null);
  const cancelled = useRef(false);

  useEffect(() => () => { cancelled.current = true; }, []);

  async function useFolder(folder: string) {
    setError(null);
    setBusy(true);
    try {
      await api.saveSettings({ musicPath: folder });
      // The backend starts scanning; wait for it so the library is populated when the app appears.
      for (;;) {
        await new Promise((r) => setTimeout(r, 400));
        if (cancelled.current) return;
        const status = await api.libraryStatus();
        setProgress({ found: status.scan.filesFound, scanned: status.scan.filesScanned });
        if (!status.scan.running) break;
      }
      onReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that folder');
      setBusy(false);
      setProgress(null);
    }
  }

  async function choose() {
    const picked = await window.sonoraDesktop?.chooseFolder();
    if (picked) await useFolder(picked);
  }

  return (
    <div className="grid h-[100dvh] place-items-center px-6">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#ff6b6b] to-[#ff9f68] shadow-lg shadow-accent/30">
          <Music2 className="h-7 w-7 text-white" strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome to Sonora</h1>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          Choose the folder your music lives in. Sonora plays it right from there and never changes your files.
        </p>

        {busy ? (
          <p className="mt-8 text-sm text-secondary" role="status">
            {progress && progress.found > 0
              ? `Reading your music… ${progress.scanned} of ${progress.found} files`
              : 'Looking for music…'}
          </p>
        ) : settings.desktop ? (
          <button type="button" onClick={choose} className="btn-accent mt-8 inline-flex items-center gap-2">
            <FolderOpen className="h-4 w-4" /> Choose music folder
          </button>
        ) : (
          <form
            className="mt-8 flex flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); if (path.trim()) void useFolder(path.trim()); }}
          >
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/path/to/your/music"
              aria-label="Music folder path"
              className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button type="submit" className="btn-accent" disabled={!path.trim()}>Use this folder</button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-red-400" role="alert">{error}</p>}
      </div>
    </div>
  );
}
