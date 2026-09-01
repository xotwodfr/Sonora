import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, MoonStar, RefreshCw, Search, Sun } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { Spinner } from '../ui/Spinner';

/** Map route prefixes to a human page title for the breadcrumb. */
const TITLES: Record<string, string> = {
  '/': 'Listen Now',
  '/recent': 'Recently Added',
  '/artists': 'Artists',
  '/albums': 'Albums',
  '/songs': 'Songs',
  '/genres': 'Genres',
  '/playlists': 'Playlists',
  '/favorites': 'Favorites',
  '/settings': 'Settings',
};

export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const status = useLibraryStore((s) => s.status);
  const runScan = useLibraryStore((s) => s.runScan);
  const scanning = !!status?.scan.running;

  // Resolve breadcrumb: exact match first, then longest prefix segment.
  const segment = '/' + (location.pathname.split('/')[1] ?? '');
  const title = TITLES[location.pathname] ?? TITLES[segment] ?? 'Sonora';

  // Keep the running scan reflected in the scan button.
  useEffect(() => {
    if (!status) void useLibraryStore.getState().loadStatus();
  }, [status]);

  return (
    <header
      className="glass-backdrop-soft sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-[var(--glass-border)] px-4"
      role="banner"
    >
      {/* History */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="glass-control h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate(1)}
          aria-label="Go forward"
          className="glass-control h-8 w-8"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Page title */}
      <h1 className="ml-2 hidden truncate text-[15px] font-semibold sm:block">{title}</h1>

      <div className="flex-1" />

      {/* Search */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="glass-control hidden h-8 w-64 items-center gap-2 rounded-full px-3 text-sm text-tertiary transition-colors hover:text-secondary sm:flex"
        aria-label="Search (⌘K)"
      >
        <Search className="h-4 w-4" strokeWidth={1.9} />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded-md border border-[var(--glass-border)] bg-[var(--glass-fill)] px-1.5 py-0.5 text-[10px] text-tertiary">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={onOpenSearch}
        className="glass-control h-8 w-8 sm:hidden"
        aria-label="Search"
      >
        <Search className="h-4 w-4" strokeWidth={1.9} />
      </button>

      {/* Rescan */}
      {scanning ? (
        <span className="flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-1.5 text-xs text-secondary" role="status">
          <Spinner size={14} />
          Scanning… {status?.scan.filesScanned ?? 0}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => void runScan()}
          aria-label="Rescan library"
          title="Rescan your music library"
          className="glass-control h-8 w-8"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.9} />
        </button>
      )}

      {/* Theme */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="glass-control h-8 w-8"
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" strokeWidth={1.9} />
        ) : (
          <MoonStar className="h-4 w-4" strokeWidth={1.9} />
        )}
      </button>
    </header>
  );
}