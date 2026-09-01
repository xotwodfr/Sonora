import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MicOff } from 'lucide-react';
import { useLyricsStore } from '../../stores/lyricsStore';
import { useSettingsStore, type LyricsMode } from '../../stores/settingsStore';

/** Shared lyrics display — rendered inside the full-screen player. */
export function LyricsView() {
  const currentLyrics = useLyricsStore((s) => s.currentLyrics);
  const loading = useLyricsStore((s) => s.loading);
  const activeLineIndex = useLyricsStore((s) => s.activeLineIndex);
  const lyricsOpen = useLyricsStore((s) => s.lyricsOpen);
  const lyricsMode = useSettingsStore((s) => s.lyrics.mode);

  if (!lyricsOpen) return null;

  return (
    <motion.div
      role="region"
      aria-label="Lyrics"
      aria-live="polite"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col overflow-hidden"
    >
      {loading && <LyricsSkeleton />}
      {!loading && !currentLyrics && <EmptyState />}
      {!loading && currentLyrics && currentLyrics.synced && currentLyrics.lines && (
        <LyricsContent
          lines={currentLyrics.lines}
          activeIndex={activeLineIndex}
          mode={lyricsMode}
        />
      )}
      {!loading && currentLyrics && !currentLyrics.synced && currentLyrics.plainText && (
        <UnsyncedLyrics text={currentLyrics.plainText} />
      )}
    </motion.div>
  );
}

/** Main lyrics content that dispatches to the appropriate mode */
function LyricsContent({
  lines,
  activeIndex,
  mode,
}: {
  lines: Array<{ time: number; text: string }>;
  activeIndex: number;
  mode: LyricsMode;
}) {
  switch (mode) {
    case 'classic':
      return <ClassicLyrics lines={lines} activeIndex={activeIndex} />;
    case 'karaoke':
      return <KaraokeLyrics lines={lines} activeIndex={activeIndex} />;
    case 'minimal':
      return <MinimalLyrics lines={lines} activeIndex={activeIndex} />;
    case 'spicy':
    default:
      return <SpicyLyrics lines={lines} activeIndex={activeIndex} />;
  }
}

/** Shared scroll container with auto-follow logic */
function useLyricsScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  lineRefs: React.MutableRefObject<Map<number, HTMLParagraphElement>>,
  activeIndex: number,
) {
  const autoFollowSuspended = useLyricsStore((s) => s.autoFollowSuspended);
  const suspendAutoFollow = useLyricsStore((s) => s.suspendAutoFollow);
  const resumeAutoFollow = useLyricsStore((s) => s.resumeAutoFollow);

  // Track scroll position to detect manual scrolling
  const lastScrollTop = useRef(0);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle manual scroll detection
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const scrollDelta = Math.abs(currentScrollTop - lastScrollTop.current);

    // If user scrolled significantly, suspend auto-follow
    if (scrollDelta > 30) {
      suspendAutoFollow();
    }

    lastScrollTop.current = currentScrollTop;

    // Clear existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    // Re-enable auto-follow after a delay of no scrolling
    scrollTimeout.current = setTimeout(() => {
      // Only re-enable if we're near the active line
      const activeEl = lineRefs.current.get(activeIndex);
      if (activeEl && container) {
        const rect = activeEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;
        const containerHeight = containerRect.height;

        // If active line is within the middle 60% of the container, re-enable
        if (relativeTop > containerHeight * 0.2 && relativeTop < containerHeight * 0.8) {
          resumeAutoFollow();
        }
      }
    }, AUTO_FOLLOW_RESUME_DELAY);
  }, [activeIndex, suspendAutoFollow, resumeAutoFollow, containerRef, lineRefs]);

  // Scroll to active line when it changes (if auto-follow is not suspended)
  useEffect(() => {
    if (autoFollowSuspended || activeIndex < 0) return;

    const el = lineRefs.current.get(activeIndex);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, autoFollowSuspended, lineRefs]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  return { handleScroll };
}

const AUTO_FOLLOW_RESUME_DELAY = 8000;

/** Spicy / Synced mode — large centered lines with emphasis */
function SpicyLyrics({
  lines,
  activeIndex,
}: {
  lines: Array<{ time: number; text: string }>;
  activeIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());
  const seekToLine = useLyricsStore((s) => s.seekToLine);
  const settings = useSettingsStore((s) => s.lyrics);

  const { handleScroll } = useLyricsScroll(containerRef, lineRefs, activeIndex);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6"
      style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)' }}
    >
      <div className="flex flex-col items-center gap-2 pb-24 pt-8">
        {lines.map((line, i) => {
          const isActive = i === activeIndex;
          const isPast = activeIndex >= 0 && i < activeIndex;
          const distance = activeIndex >= 0 ? Math.abs(i - activeIndex) : 0;

          // Calculate opacity based on distance from active line
          let opacity = 1;
          if (isActive) {
            opacity = 1;
          } else if (isPast) {
            opacity = Math.max(0.3, 1 - distance * 0.15);
          } else {
            opacity = Math.max(0.35, 1 - distance * 0.12);
          }

          // Scale: active line is slightly larger
          const scale = isActive ? 1.05 : 1;

          // Font weight
          const fontWeight = isActive ? 600 : 400;

          return (
            <p
              key={`${i}-${line.time}`}
              ref={(el) => {
                if (el) lineRefs.current.set(i, el);
                else lineRefs.current.delete(i);
              }}
              onClick={() => seekToLine(i)}
              aria-current={isActive ? 'true' : undefined}
              className="w-full cursor-pointer text-center leading-relaxed transition-all duration-300 ease-out"
              style={{
                fontSize: `${1.125 * settings.textSize}rem`,
                opacity,
                transform: `scale(${scale})`,
                fontWeight,
                color: isActive ? 'var(--text)' : isPast ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                textShadow: isActive ? '0 0 20px rgba(255,255,255,0.15)' : 'none',
                padding: '4px 16px',
                borderRadius: '8px',
                background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {line.text || ' '}
            </p>
          );
        })}
      </div>
    </div>
  );
}

/** Classic mode — compact vertically scrolling text */
function ClassicLyrics({
  lines,
  activeIndex,
}: {
  lines: Array<{ time: number; text: string }>;
  activeIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());
  const seekToLine = useLyricsStore((s) => s.seekToLine);
  const settings = useSettingsStore((s) => s.lyrics);

  const { handleScroll } = useLyricsScroll(containerRef, lineRefs, activeIndex);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-6 py-6"
    >
      <div className="flex flex-col gap-1 pb-24 pt-8">
        {lines.map((line, i) => {
          const isActive = i === activeIndex;
          const isPast = activeIndex >= 0 && i < activeIndex;

          return (
            <p
              key={`${i}-${line.time}`}
              ref={(el) => {
                if (el) lineRefs.current.set(i, el);
                else lineRefs.current.delete(i);
              }}
              onClick={() => seekToLine(i)}
              aria-current={isActive ? 'true' : undefined}
              className="w-full cursor-pointer rounded-md px-3 py-1.5 transition-all duration-200 ease-out"
              style={{
                fontSize: `${0.9375 * settings.textSize}rem`,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text)' : isPast ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                minHeight: '36px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {line.text || ' '}
            </p>
          );
        })}
      </div>
    </div>
  );
}

/** Karaoke mode — strong focus on current line, minimized surrounding */
function KaraokeLyrics({
  lines,
  activeIndex,
}: {
  lines: Array<{ time: number; text: string }>;
  activeIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());
  const seekToLine = useLyricsStore((s) => s.seekToLine);
  const settings = useSettingsStore((s) => s.lyrics);

  const { handleScroll } = useLyricsScroll(containerRef, lineRefs, activeIndex);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6"
      style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' }}
    >
      <div className="flex flex-col items-center gap-1 pb-24 pt-8">
        {lines.map((line, i) => {
          const isActive = i === activeIndex;
          const isPast = activeIndex >= 0 && i < activeIndex;
          const distance = activeIndex >= 0 ? Math.abs(i - activeIndex) : 0;

          // Karaoke: aggressively minimize non-active lines
          let opacity = 1;
          if (isActive) {
            opacity = 1;
          } else if (isPast) {
            opacity = Math.max(0.15, 0.5 - distance * 0.1);
          } else {
            opacity = Math.max(0.2, 0.6 - distance * 0.15);
          }

          // Scale: active line is much larger
          const scale = isActive ? 1.15 : 0.9;

          return (
            <p
              key={`${i}-${line.time}`}
              ref={(el) => {
                if (el) lineRefs.current.set(i, el);
                else lineRefs.current.delete(i);
              }}
              onClick={() => seekToLine(i)}
              aria-current={isActive ? 'true' : undefined}
              className="w-full cursor-pointer text-center transition-all duration-250 ease-out"
              style={{
                fontSize: isActive ? `${1.5 * settings.textSize}rem` : `${0.875 * settings.textSize}rem`,
                opacity,
                transform: `scale(${scale})`,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? 'var(--text)' : 'var(--text-tertiary)',
                textShadow: isActive ? '0 0 24px rgba(255,255,255,0.2)' : 'none',
                padding: isActive ? '8px 20px' : '2px 16px',
                borderRadius: '8px',
                background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                minHeight: isActive ? '56px' : '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {line.text || ' '}
            </p>
          );
        })}
      </div>
    </div>
  );
}

/** Minimal mode — clean, small typography, minimal animation */
function MinimalLyrics({
  lines,
  activeIndex,
}: {
  lines: Array<{ time: number; text: string }>;
  activeIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());
  const seekToLine = useLyricsStore((s) => s.seekToLine);
  const settings = useSettingsStore((s) => s.lyrics);

  const { handleScroll } = useLyricsScroll(containerRef, lineRefs, activeIndex);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-6 py-6"
    >
      <div className="flex flex-col gap-0.5 pb-24 pt-8">
        {lines.map((line, i) => {
          const isActive = i === activeIndex;
          const isPast = activeIndex >= 0 && i < activeIndex;

          return (
            <p
              key={`${i}-${line.time}`}
              ref={(el) => {
                if (el) lineRefs.current.set(i, el);
                else lineRefs.current.delete(i);
              }}
              onClick={() => seekToLine(i)}
              aria-current={isActive ? 'true' : undefined}
              className="w-full cursor-pointer rounded px-2 py-1 transition-colors duration-150"
              style={{
                fontSize: `${0.8125 * settings.textSize}rem`,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text)' : isPast ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                opacity: isActive ? 1 : isPast ? 0.6 : 0.7,
                minHeight: '28px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {line.text || ' '}
            </p>
          );
        })}
      </div>
    </div>
  );
}

/** Unsynced lyrics: plain text display, no highlighting. */
function UnsyncedLyrics({ text }: { text: string }) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="flex flex-col items-center gap-2 pb-24 pt-8">
        {text.split('\n').map((line, i) => (
          <p
            key={i}
            className="w-full text-center text-base leading-relaxed text-[var(--text-secondary)]"
          >
            {line || ' '}
          </p>
        ))}
      </div>
    </div>
  );
}

/** Loading skeleton matching the lyrics layout. */
function LyricsSkeleton() {
  return (
    <div className="flex-1 overflow-hidden px-4 py-6">
      <div className="flex flex-col items-center gap-3 pb-24 pt-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="skeleton h-5 rounded"
            style={{ width: `${50 + Math.sin(i) * 20}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Empty state when no lyrics exist. */
function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[var(--text-tertiary)]">
      <MicOff className="h-10 w-10" strokeWidth={1.5} />
      <p className="text-sm font-medium">Lyrics unavailable</p>
    </div>
  );
}
