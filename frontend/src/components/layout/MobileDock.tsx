import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Captions, ChevronUp, Disc3, Home, ListMusic, Music2, Pause, Play, Search, SkipForward } from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { useLyricsStore } from '../../stores/lyricsStore';
import { artworkUrl } from '../../lib/api';
import { Artwork } from '../ui/Artwork';

const TABS = [
  { to: '/', label: 'Listen Now', icon: Home, end: true },
  { to: '/albums', label: 'Albums', icon: Disc3 },
  { to: '/songs', label: 'Songs', icon: Music2 },
  { to: '/playlists', label: 'Playlists', icon: ListMusic },
];

/** Compact bottom dock for screens under the sidebar breakpoint. */
export function MobileDock() {
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const setFullScreen = usePlayerStore((s) => s.setFullScreen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const setLyricsOpen = useLyricsStore((s) => s.setLyricsOpen);

  const art = artworkUrl(current);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      {/* Compact now-playing card (morphs into the full-screen artwork) */}
      <AnimatePresence>
        {current && (
          <motion.div
            key="mini-player"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong mx-3 mb-3 flex items-center gap-2 rounded-2xl p-2"
          >
            <button
              type="button"
              onClick={() => setFullScreen(true)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <motion.div layoutId="np-art" className="shrink-0">
                <Artwork src={art} alt="" className="h-11 w-11 rounded-lg" />
              </motion.div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">{current.title}</p>
                <p className="truncate text-[11px] text-secondary">{current.artist ?? 'Unknown Artist'}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => toggle()}
              aria-label={playing ? 'Pause' : 'Play'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-text"
            >
              {playing ? (
                <Pause className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              ) : (
                <Play className="ml-0.5 h-4 w-4" fill="currentColor" strokeWidth={0} />
              )}
            </button>
            <button
              type="button"
              onClick={() => next()}
              aria-label="Next track"
              className="glass-control h-8 w-8 shrink-0"
            >
              <SkipForward className="h-4 w-4" fill="currentColor" strokeWidth={1.9} />
            </button>
            <button
              type="button"
              onClick={() => {
                setFullScreen(true);
                setLyricsOpen(true);
              }}
              aria-label="Show lyrics"
              className="glass-control h-8 w-8 shrink-0"
            >
              <Captions className="h-4 w-4" strokeWidth={1.9} />
            </button>
            <button
              type="button"
              onClick={() => setFullScreen(true)}
              aria-label="Open full-screen player"
              className="glass-control h-8 w-8 shrink-0"
            >
              <ChevronUp className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab bar */}
      <div className="glass-backdrop-soft border-t border-[var(--glass-border)] bg-[var(--bg)]/80 pb-[env(safe-area-inset-bottom)]">
        <nav className="relative grid grid-cols-5" aria-label="Mobile navigation">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-secondary'
                }`
              }
            >
              <tab.icon className="h-5 w-5" strokeWidth={1.9} />
              {tab.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-secondary"
          >
            <Search className="h-5 w-5" strokeWidth={1.9} />
            Search
          </button>
        </nav>
      </div>
    </div>
  );
}