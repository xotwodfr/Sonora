import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Captions,
  ChevronDown,
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useLyricsStore } from '../../stores/lyricsStore';
import { useThemeStore } from '../../stores/themeStore';
import { artworkUrl } from '../../lib/api';
import { formatDuration } from '../../lib/format';
import { Artwork } from '../ui/Artwork';
import { Slider } from './Slider';
import { LyricsView } from './LyricsView';

export function FullScreenPlayer() {
  const fullScreen = usePlayerStore((s) => s.fullScreen);
  const setFullScreen = usePlayerStore((s) => s.setFullScreen);

  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const duration = usePlayerStore((s) => s.duration);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);

  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setMuted = usePlayerStore((s) => s.setMuted);
  const setShuffle = usePlayerStore((s) => s.setShuffle);
  const setRepeat = usePlayerStore((s) => s.setRepeat);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  const setQueueOpen = useUIStore((s) => s.setQueueOpen);
  const queueOpen = useUIStore((s) => s.queueOpen);
  const queueLength = usePlayerStore((s) => s.queue.length);

  const lyricsOpen = useLyricsStore((s) => s.lyricsOpen);
  const setLyricsOpen = useLyricsStore((s) => s.setLyricsOpen);

  const art = artworkUrl(current);
  const artKey = art ?? 'none';

  // Escape closes the player.
  useEffect(() => {
    if (!fullScreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullScreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullScreen, setFullScreen]);

  // Accent tint: use extracted palette when available, fall back to hash-based.
  const palette = useThemeStore((s) => s.currentPalette);
  const tint = useMemo(() => {
    if (palette?.valid) return palette.accent;
    const seed = current?.id ?? 0;
    const hue = (seed * 47) % 360;
    return `hsl(${hue} 70% 45%)`;
  }, [palette?.valid, palette?.accent, current?.id]);

  if (!fullScreen || !current) return null;

  return (
    <motion.div
      key="fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing: ${current.title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-50 overflow-hidden"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setFullScreen(false);
      }}
    >
      {/* Dynamic blurred artwork backdrop */}
      <div className="absolute inset-0" aria-hidden>
        <AnimatePresence>
          {art && (
            <motion.img
              key={artKey}
              src={art}
              alt=""
              className="h-full w-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              style={{ filter: 'blur(72px) saturate(1.5) brightness(0.9)', transform: 'scale(1.3)' }}
            />
          )}
        </AnimatePresence>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 20% 0%, ${tint}28 0%, transparent 55%), linear-gradient(var(--player-overlay), var(--player-overlay))`,
          }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setFullScreen(false)}
          aria-label="Close full-screen player"
          className="glass-control h-10 w-10"
        >
          <ChevronDown className="h-5 w-5" strokeWidth={2} />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQueueOpen(!queueOpen)}
            aria-label="Toggle queue"
            aria-pressed={queueOpen}
            className={`glass-control h-10 w-10 ${queueOpen ? 'is-on' : ''}`}
          >
            <ListMusic className="h-5 w-5" strokeWidth={1.9} />
            {queueLength > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-text">
                {queueLength}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setLyricsOpen(!lyricsOpen)}
            aria-label={lyricsOpen ? 'Hide lyrics' : 'Show lyrics'}
            aria-pressed={lyricsOpen}
            className={`glass-control h-10 w-10 ${lyricsOpen ? 'is-on' : ''}`}
          >
            <Captions className="h-5 w-5" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => void toggleFavorite(current.id)}
            aria-label={current.favorite ? 'Remove from favorites' : 'Add to favorites'}
            className={`glass-control h-10 w-10 ${current.favorite ? 'is-on' : ''}`}
          >
            <Heart
              className="h-5 w-5"
              strokeWidth={1.8}
              fill={current.favorite ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex h-[calc(100%-7rem)] flex-col items-center justify-center gap-8 px-6 pb-10 lg:flex-row lg:gap-16 lg:px-16">
        {/* Artwork — shrinks when lyrics are open on desktop */}
        <div className={`relative shrink-0 transition-all duration-300 ${lyricsOpen ? 'lg:h-[50vh] lg:w-auto' : ''}`}>
          <motion.div layoutId="np-art" className="relative">
            <Artwork
              src={art}
              alt={current.album ?? ''}
              className={`rounded-2xl transition-all duration-300 ${
                lyricsOpen
                  ? 'h-[30vw] w-[30vw] max-h-[32vh] max-w-[32vh] sm:h-[36vw] sm:w-[36vw] lg:h-[50vh] lg:w-[50vh]'
                  : 'h-[42vw] w-[42vw] max-h-[46vh] max-w-[46vh] sm:h-[52vw] sm:w-[52vw] lg:h-[64vh] lg:w-[64vh]'
              }`}
              radius="rounded"
            />
          </motion.div>
          {/* Soft reflection under the cover */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 -bottom-8 h-16 rounded-[100%] opacity-40 blur-2xl"
            style={{ background: tint }}
          />
        </div>

        {/* Lyrics panel — only when open */}
        {lyricsOpen && (
          <motion.div
            key="lyrics-panel"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="h-[50vh] w-full max-w-lg overflow-hidden rounded-2xl lg:h-[64vh] lg:flex-1"
          >
            <LyricsView />
          </motion.div>
        )}

        {/* Meta + controls */}
        <div className="flex w-full max-w-lg flex-col items-center gap-5 lg:items-start">
          <div className="text-center lg:text-left">
            <h2 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{current.title}</h2>
            <p className="mt-1.5 truncate text-base text-secondary">
              {current.artist ?? 'Unknown Artist'}
              {current.album ? ` — ${current.album}` : ''}
            </p>
          </div>

          <div className="w-full">
            <Slider
              value={Math.min(currentTime, duration || currentTime)}
              max={duration || 1}
              onChange={(v) => seek(v)}
              ariaLabel="Seek"
              className="py-1"
            />
            <div className="mt-1 flex w-full justify-between px-1 text-xs tabular-nums text-secondary">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setShuffle(!shuffle)}
              aria-label={shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
              aria-pressed={shuffle}
              className={`glass-control h-10 w-10 ${shuffle ? 'is-on' : ''}`}
            >
              <Shuffle className="h-5 w-5" strokeWidth={1.9} />
            </button>
            <button type="button" onClick={() => prev()} aria-label="Previous track" className="glass-control h-11 w-11">
              <SkipBack className="h-6 w-6" fill="currentColor" strokeWidth={1.6} />
            </button>
            <button
              type="button"
              onClick={() => toggle()}
              aria-label={playing ? 'Pause' : 'Play'}
              className="grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-text shadow-xl shadow-accent/40 transition hover:scale-105 active:scale-95"
            >
              {playing ? (
                <Pause className="h-7 w-7" fill="currentColor" strokeWidth={0} />
              ) : (
                <Play className="ml-1 h-7 w-7" fill="currentColor" strokeWidth={0} />
              )}
            </button>
            <button type="button" onClick={() => next()} aria-label="Next track" className="glass-control h-11 w-11">
              <SkipForward className="h-6 w-6" fill="currentColor" strokeWidth={1.6} />
            </button>
            <button
              type="button"
              onClick={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}
              aria-label={`Repeat: ${repeat}`}
              aria-pressed={repeat !== 'off'}
              className={`glass-control h-10 w-10 ${repeat !== 'off' ? 'is-on' : ''}`}
            >
              <Repeat className="h-5 w-5" strokeWidth={1.9} />
              {repeat === 'one' && (
                <span className="absolute inset-0 grid place-items-center text-[8px] font-bold">1</span>
              )}
            </button>
          </div>

          {/* Volume */}
          <div className="hidden items-center gap-2 sm:flex">
            <button type="button" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'} className="glass-control h-8 w-8">
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" strokeWidth={1.9} />
              ) : (
                <Volume2 className="h-4 w-4" strokeWidth={1.9} />
              )}
            </button>
            <div className="w-32">
              <Slider value={muted ? 0 : volume} max={1} onChange={(v) => setVolume(v)} ariaLabel="Volume" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}