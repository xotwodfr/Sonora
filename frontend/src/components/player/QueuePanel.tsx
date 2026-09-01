import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronDown, ListX, X } from 'lucide-react';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { artworkUrl } from '../../lib/api';
import { formatDuration } from '../../lib/format';
import { Artwork } from '../ui/Artwork';

/** Queue drawer — slides up above the Now Playing bar. */
export function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue);
  const playOrder = usePlayerStore((s) => s.playOrder);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);

  const playFromIndex = usePlayerStore((s) => s.playFromIndex);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const moveInQueue = usePlayerStore((s) => s.moveInQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const setFullScreen = usePlayerStore((s) => s.setFullScreen);

  const setQueueOpen = useUIStore((s) => s.setQueueOpen);

  const order = playOrder ?? queue.map((_, i) => i);
  const shown = order as number[];

  return (
    <motion.aside
      role="dialog"
      aria-label="Playback queue"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="glass-strong fixed bottom-24 right-4 z-40 flex max-h-[min(60vh,560px)] w-[340px] flex-col overflow-hidden rounded-2xl lg:bottom-[6.4rem]"
    >
      <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setQueueOpen(false)} aria-label="Close queue" className="glass-control h-7 w-7">
            <ChevronDown className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold">Up Next</h2>
            <p className="text-[11px] text-secondary">{queue.length} song{queue.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        {queue.length > 0 && (
          <button
            type="button"
            onClick={clearQueue}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-secondary transition hover:text-red-400"
          >
            <ListX className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="overflow-y-auto p-1.5">
        {queue.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-tertiary">
            Queue is empty. Play something and it'll appear here.
          </p>
        ) : (
          shown.map((real, orderIndex) => {
            const track = queue[real];
            const isCurrent = orderIndex === currentIndex;
            const art = artworkUrl(track);
            return (
              <div
                key={`${track.id}:${orderIndex}`}
                className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
                  isCurrent ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--glass-fill-strong)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => playFromIndex(orderIndex)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left"
                >
                  <div className="relative shrink-0">
                    <Artwork src={art} alt="" className="h-10 w-10 rounded-md" />
                    {isCurrent && (
                      <span className="absolute inset-0 grid place-items-center rounded-md bg-black/45">
                        <Equalizer playing={playing} />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-[13px] ${isCurrent ? 'font-semibold text-accent' : ''}`}>
                      {track.title}
                    </p>
                    <p className="truncate text-[11px] text-secondary">{track.artist ?? 'Unknown Artist'}</p>
                  </div>
                </button>
                <span className="shrink-0 text-[11px] tabular-nums text-tertiary">
                  {formatDuration(track.duration)}
                </span>
                <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveInQueue(orderIndex, orderIndex - 1)}
                    disabled={orderIndex === 0}
                    aria-label="Move up"
                    className="grid h-5 w-5 place-items-center rounded text-secondary hover:text-default disabled:opacity-30"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveInQueue(orderIndex, orderIndex + 1)}
                    disabled={orderIndex === shown.length - 1}
                    aria-label="Move down"
                    className="grid h-5 w-5 place-items-center rounded text-secondary hover:text-default disabled:opacity-30"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromQueue(orderIndex)}
                  aria-label="Remove from queue"
                  className="shrink-0 rounded p-0.5 text-tertiary opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
        {current && (
          <p className="px-3 pb-2 pt-3 text-center">
            <button
              type="button"
              onClick={() => {
                setQueueOpen(false);
                setFullScreen(true);
              }}
              className="text-xs font-medium text-accent transition hover:underline"
            >
              Open full-screen player
            </button>
          </p>
        )}
      </div>
    </motion.aside>
  );
}

/** Animated 3-bar equalizer for the currently-playing row. */
function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
      {[0.5, 1, 0.7].map((_, i) => (
        <motion.span
          key={i}
          className="w-[2.5px] rounded-full bg-accent"
          animate={playing ? { height: ['30%', '100%', '45%'] } : { height: '30%' }}
          transition={playing ? { duration: 0.9, delay: i * 0.15, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
        />
      ))}
    </span>
  );
}