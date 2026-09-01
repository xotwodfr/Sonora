import { motion, AnimatePresence } from 'framer-motion';
import {
  Captions,
  ChevronUp,
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
import { artworkUrl } from '../../lib/api';
import { formatDuration } from '../../lib/format';
import { Artwork } from '../ui/Artwork';
import { Slider } from '../player/Slider';

export function NowPlayingBar() {
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const duration = usePlayerStore((s) => s.duration);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const fullScreen = usePlayerStore((s) => s.fullScreen);

  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setMuted = usePlayerStore((s) => s.setMuted);
  const setFullScreen = usePlayerStore((s) => s.setFullScreen);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const setShuffle = usePlayerStore((s) => s.setShuffle);
  const setRepeat = usePlayerStore((s) => s.setRepeat);
  const repeat = usePlayerStore((s) => s.repeat);

  const queueOpen = useUIStore((s) => s.queueOpen);
  const setQueueOpen = useUIStore((s) => s.setQueueOpen);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const setLyricsOpen = useLyricsStore((s) => s.setLyricsOpen);

  const art = artworkUrl(current);

  return (
    <AnimatePresence initial={false}>
      <motion.footer
        key={current ? 'bar' : 'empty'}
        initial={{ height: current ? 80 : 40, opacity: 0 }}
        animate={{ height: current ? 80 : 40, opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={`glass-strong relative z-30 mx-3 mb-3 hidden shrink-0 overflow-hidden rounded-2xl lg:flex ${
          current ? '' : 'items-center justify-center'
        }`}
      >
        {!current && (
          <p className="text-xs font-medium text-tertiary">Nothing playing — pick a song</p>
        )}

        {current && (
          <div className="grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
            {/* Left: artwork + meta */}
            <div className="flex min-w-0 items-center gap-3">
              {!fullScreen && (
                <motion.button
                  layoutId="np-art"
                  type="button"
                  onClick={() => setFullScreen(true)}
                  aria-label={`Open now playing for ${current.title}`}
                  className="relative z-10 shrink-0 cursor-pointer"
                >
                  <Artwork src={art} alt={current.album ?? ''} className="h-[52px] w-[52px] rounded-xl" />
                </motion.button>
              )}
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setFullScreen(true)}
                  className="block w-full truncate text-left text-sm font-semibold text-default transition-colors hover:text-accent"
                  title={current.title}
                >
                  {current.title}
                </button>
                <p className="truncate text-xs text-secondary">{current.artist ?? 'Unknown Artist'}</p>
              </div>
              <button
                type="button"
                onClick={() => void toggleFavorite(current.id)}
                aria-label={current.favorite ? 'Remove from favorites' : 'Add to favorites'}
                className={`glass-control hidden h-7 w-7 md:grid ${current.favorite ? 'is-on' : ''}`}
              >
                <Heart
                  className="h-3.5 w-3.5"
                  strokeWidth={1.9}
                  fill={current.favorite ? 'currentColor' : 'none'}
                />
              </button>
            </div>

            {/* Center: transport */}
            <div className="flex w-full max-w-xl flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShuffle(!shuffle)}
                  aria-label={shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
                  aria-pressed={shuffle}
                  className={`glass-control h-8 w-8 ${shuffle ? 'is-on' : ''}`}
                >
                  <Shuffle className="h-4 w-4" strokeWidth={1.9} />
                </button>
                <button type="button" onClick={() => prev()} aria-label="Previous track" className="glass-control h-8 w-8">
                  <SkipBack className="h-[18px] w-[18px]" strokeWidth={1.9} fill="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={() => toggle()}
                  aria-label={playing ? 'Pause' : 'Play'}
                  className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-text transition hover:scale-105 active:scale-95"
                >
                  {playing ? (
                    <Pause className="h-5 w-5" fill="currentColor" strokeWidth={0} />
                  ) : (
                    <Play className="ml-0.5 h-5 w-5" fill="currentColor" strokeWidth={0} />
                  )}
                </button>
                <button type="button" onClick={() => next()} aria-label="Next track" className="glass-control h-8 w-8">
                  <SkipForward className="h-[18px] w-[18px]" strokeWidth={1.9} fill="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}
                  aria-label={`Repeat: ${repeat}`}
                  aria-pressed={repeat !== 'off'}
                  className={`glass-control h-8 w-8 ${repeat !== 'off' ? 'is-on' : ''} ${
                    repeat === 'one' ? 'relative' : ''
                  }`}
                >
                  <Repeat className="h-4 w-4" strokeWidth={1.9} />
                  {repeat === 'one' && (
                    <span className="absolute inset-0 grid place-items-center text-[8px] font-bold">1</span>
                  )}
                </button>
              </div>
              <div className="flex w-full items-center gap-2.5">
                <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-tertiary">
                  {formatDuration(currentTime)}
                </span>
                <div className="flex-1">
                  <Slider
                    value={Math.min(currentTime, duration || currentTime)}
                    max={duration || 1}
                    onChange={(v) => seek(v)}
                    ariaLabel="Seek"
                    size="sm"
                  />
                </div>
                <span className="w-9 shrink-0 text-[10px] tabular-nums text-tertiary">
                  {formatDuration(duration)}
                </span>
              </div>
            </div>

            {/* Right: queue + volume + expand */}
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setQueueOpen(!queueOpen)}
                aria-label="Toggle queue"
                aria-pressed={queueOpen}
                className={`glass-control h-8 w-8 ${queueOpen ? 'is-on' : ''}`}
              >
                <ListMusic className="h-4 w-4" strokeWidth={1.9} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setFullScreen(true);
                  setLyricsOpen(true);
                }}
                aria-label="Show lyrics"
                className="glass-control h-8 w-8"
              >
                <Captions className="h-4 w-4" strokeWidth={1.9} />
              </button>
              <div className="hidden items-center gap-1.5 xl:flex">
                <button
                  type="button"
                  onClick={() => setMuted(!muted)}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  className="glass-control h-7 w-7"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" strokeWidth={1.9} />
                  ) : (
                    <Volume2 className="h-4 w-4" strokeWidth={1.9} />
                  )}
                </button>
                <div className="w-24">
                  <Slider
                    value={muted ? 0 : volume}
                    max={1}
                    onChange={(v) => setVolume(v)}
                    ariaLabel="Volume"
                    size="sm"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFullScreen(true)}
                aria-label="Open full-screen player"
                className="glass-control h-8 w-8"
              >
                <ChevronUp className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </motion.footer>
    </AnimatePresence>
  );
}