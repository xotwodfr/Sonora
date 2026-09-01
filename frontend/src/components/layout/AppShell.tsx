import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '../../stores/uiStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { NowPlayingBar } from './NowPlayingBar';
import { MobileDock } from './MobileDock';
import { QueuePanel } from '../player/QueuePanel';
import { FullScreenPlayer } from '../player/FullScreenPlayer';
import { SearchOverlay } from '../search/SearchOverlay';
import { ScrollContext } from './ScrollContext';

/** Layout shell: sidebar + scrollable content + now-playing bar + overlays. */
export function AppShell() {
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const queueOpen = useUIStore((s) => s.queueOpen);
  const setQueueOpen = useUIStore((s) => s.setQueueOpen);
  const fullScreen = usePlayerStore((s) => s.fullScreen);
  const location = useLocation();

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  // Keyboard shortcuts ↔ store wiring (see useKeyboardShortcuts for the keys).
  useKeyboardShortcuts();
  useEffect(() => {
    const onPlayPause = () => usePlayerStore.getState().toggle();
    const onNext = () => usePlayerStore.getState().next(true);
    const onPrev = () => usePlayerStore.getState().prev();
    const onToggleSearch = () => setSearchOpen(!useUIStore.getState().searchOpen);
    const onToggleTheme = () => useUIStore.getState().toggleTheme();
    window.addEventListener('sonora:playpause', onPlayPause);
    window.addEventListener('sonora:next', onNext);
    window.addEventListener('sonora:prev', onPrev);
    window.addEventListener('sonora:toggle-search', onToggleSearch);
    window.addEventListener('sonora:toggle-theme', onToggleTheme);
    return () => {
      window.removeEventListener('sonora:playpause', onPlayPause);
      window.removeEventListener('sonora:next', onNext);
      window.removeEventListener('sonora:prev', onPrev);
      window.removeEventListener('sonora:toggle-search', onToggleSearch);
      window.removeEventListener('sonora:toggle-theme', onToggleTheme);
    };
  }, [setSearchOpen]);

  // Load scan status and restore persisted playback on boot.
  useEffect(() => {
    void useLibraryStore.getState().loadStatus();
    void usePlayerStore.getState().init();
  }, []);

  // Close transient panels + reset scroll position on navigation.
  useEffect(() => {
    setQueueOpen(false);
    if (scrollEl) scrollEl.scrollTo({ top: 0 });
  }, [location.pathname, setQueueOpen, scrollEl]);

  return (
    <div className="app-shell flex h-[100dvh] flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative flex min-w-0 flex-1 flex-col">
          <TopBar onOpenSearch={() => setSearchOpen(true)} />
          <div
            ref={setScrollEl}
            className="content-scroll flex-1 overflow-y-auto px-4 pb-10 pt-5 sm:px-7 lg:px-8"
          >
            <ScrollContext.Provider value={scrollEl}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto w-full max-w-[1800px]"
              >
                <Outlet />
              </motion.div>
            </ScrollContext.Provider>
          </div>
        </main>
      </div>

      <NowPlayingBar />
      <MobileDock />

      {/* Overlays */}
      <AnimatePresence>{queueOpen && <QueuePanel />}</AnimatePresence>
      <AnimatePresence>{fullScreen && <FullScreenPlayer />}</AnimatePresence>
      <AnimatePresence>{searchOpen && <SearchOverlay />}</AnimatePresence>
    </div>
  );
}