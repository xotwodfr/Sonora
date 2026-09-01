import { create } from 'zustand';
import { api, streamUrl, artworkUrl } from '../lib/api';
import type { Track } from '../lib/types';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  audio: HTMLAudioElement | null;

  // Queue
  queue: Track[];
  currentIndex: number; // index into playOrder
  current: Track | null;

  // Shuffle: playOrder maps play position → queue index (null = natural order).
  playOrder: number[] | null;
  shuffle: boolean;
  repeat: RepeatMode;

  // Live playback
  playing: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  muted: boolean;

  // UI
  fullScreen: boolean;

  // actions
  init: () => void;
  playTracks: (tracks: Track[], startId?: number) => void;
  playTrack: (track: Track) => void;
  enqueue: (tracks: Track[]) => void;
  playNext: (track: Track) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: (manual?: boolean) => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setShuffle: (s: boolean) => void;
  setRepeat: (r: RepeatMode) => void;
  setFullScreen: (v: boolean) => void;
  removeFromQueue: (orderIndex: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  // internal / restore
  restoreQueue: (tracks: Track[], index: number) => void;
  playFromIndex: (index: number) => void;
}

const VOLUME_KEY = 'sonora-volume';
const QUEUE_KEY = 'sonora-queue';

function buildShuffleOrder(n: number, startReal: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const idx = arr.indexOf(startReal);
  if (idx > 0) {
    arr.splice(idx, 1);
    arr.unshift(startReal);
  }
  return arr;
}

function realIndex(order: number[] | null, playPos: number): number {
  return order ? order[playPos] : playPos;
}

function absoluteUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${window.location.origin}${url}`;
}

function updateMediaSession(
  track: Track | null,
  handlers: { next: () => void; prev: () => void; toggle: () => void },
) {
  if (!('mediaSession' in navigator)) return;
  if (!track) {
    navigator.mediaSession.metadata = null;
    return;
  }
  const art = artworkUrl(track);
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist ?? 'Unknown Artist',
    album: track.album ?? '',
    artwork: art ? [{ src: absoluteUrl(art), sizes: '512x512', type: 'image/*' }] : [],
  });
  try {
    navigator.mediaSession.setActionHandler('play', () => handlers.toggle());
    navigator.mediaSession.setActionHandler('pause', () => handlers.toggle());
    navigator.mediaSession.setActionHandler('nexttrack', () => handlers.next());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlers.prev());
  } catch {
    /* ignored */
  }
}

let audioEl: HTMLAudioElement | null = null;

export const usePlayerStore = create<PlayerState>((set, get) => {
  function ensureAudio(): HTMLAudioElement {
    if (audioEl) return audioEl;
    const a = new Audio();
    a.preload = 'auto';
    audioEl = a;

    a.addEventListener('timeupdate', () => set({ currentTime: a.currentTime }));
    a.addEventListener('durationchange', () => {
      if (isFinite(a.duration)) set({ duration: a.duration });
    });
    a.addEventListener('pause', () => set({ playing: false }));
    a.addEventListener('play', () => set({ playing: true }));
    a.addEventListener('ended', () => get().next());
    a.addEventListener('error', () => {
      set({ playing: false });
      get().next();
    });

    const savedVol = parseFloat(localStorage.getItem(VOLUME_KEY) ?? '1');
    if (isFinite(savedVol)) a.volume = Math.min(1, Math.max(0, savedVol));
    set({ volume: a.volume });
    return a;
  }

  return {
    audio: null,
    queue: [],
    currentIndex: -1,
    current: null,
    playOrder: null,
    shuffle: false,
    repeat: 'off',
    playing: false,
    duration: 0,
    currentTime: 0,
    volume: 1,
    muted: false,
    fullScreen: false,

    init: () => {
      const a = ensureAudio();
      set({ audio: a });
      try {
        const raw = localStorage.getItem(QUEUE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { ids: number[]; index: number; currentTime: number };
          if (Array.isArray(saved.ids) && saved.ids.length > 0) {
            api.bulkTracks(saved.ids).then((tracks) => {
              const byId = new Map(tracks.map((t) => [t.id, t]));
              const full = saved.ids.map((id) => byId.get(id)).filter(Boolean) as Track[];
              if (full.length > 0) {
                const idx = Math.min(saved.index ?? 0, full.length - 1);
                get().restoreQueue(full, idx);
                if (saved.currentTime) {
                  window.setTimeout(() => {
                    if (audioEl) audioEl.currentTime = saved.currentTime;
                  }, 250);
                }
              }
            }).catch(() => {});
          }
        }
      } catch {
        /* ignore corrupt storage */
      }
    },

    restoreQueue: (tracks, index) => {
      if (tracks.length === 0) return;
      set({
        queue: tracks,
        currentIndex: index,
        current: tracks[index],
        playOrder: null,
      });
    },

    playFromIndex: (index) => {
      const s = get();
      if (s.queue.length === 0) return;
      const real = realIndex(s.playOrder, index);
      const track = s.queue[real];
      if (!track) return;
      const a = ensureAudio();
      set({ currentIndex: index, current: track });
      a.src = streamUrl(track.id);
      a.play().catch(() => {});
      api.recordPlay(track.id).catch(() => {});
      updateMediaSession(track, {
        next: () => get().next(),
        prev: () => get().prev(),
        toggle: () => get().toggle(),
      });
    },

    playTracks: (tracks, startId) => {
      if (tracks.length === 0) return;
      let idx = startId ? tracks.findIndex((t) => t.id === startId) : 0;
      if (idx === -1) idx = 0;
      const order = get().shuffle ? buildShuffleOrder(tracks.length, idx) : null;
      set({ queue: tracks, currentIndex: order ? 0 : idx, playOrder: order, current: tracks[idx] });
      get().playFromIndex(order ? 0 : idx);
    },

    playTrack: (track) => {
      set({ queue: [track], currentIndex: 0, playOrder: null, current: track });
      get().playFromIndex(0);
    },

    enqueue: (tracks) => {
      set((s) => ({ queue: [...s.queue, ...tracks] }));
    },

    playNext: (track) => {
      const s = get();
      if (s.queue.length === 0) {
        // Nothing is queued yet — start playback with this one track.
        set({ queue: [track], currentIndex: 0, current: track, playOrder: null });
        get().playFromIndex(0);
        return;
      }
      // Append to the underlying queue, then splice it right after current
      // in the active play order.
      const queue = [...s.queue, track];
      const newReal = queue.length - 1;
      let playOrder = s.playOrder;
      if (playOrder) {
        const order = [...playOrder];
        order.splice(s.currentIndex + 1, 0, newReal);
        playOrder = order;
      }
      set({ queue, playOrder });
    },

    toggle: () => {
      const a = ensureAudio();
      if (!get().current && get().queue.length === 0) return;
      if (a.paused) {
        a.play().catch(() => {});
      } else {
        a.pause();
      }
    },

    play: () => {
      const a = ensureAudio();
      if (!get().current && get().queue.length > 0) {
        get().playFromIndex(0);
      } else {
        a.play().catch(() => {});
      }
    },

    pause: () => {
      audioEl?.pause();
    },

    next: (_manual = false) => {
      const s = get();
      const total = s.queue.length;
      if (total === 0) return;
      if (s.repeat === 'one' && audioEl) {
        audioEl.currentTime = 0;
        audioEl.play().catch(() => {});
        return;
      }
      const cur = s.currentIndex;
      if (cur >= (s.playOrder?.length ?? total) - 1) {
        // At the end.
        if (s.repeat === 'all') {
          get().playFromIndex(0);
        } else {
          if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
          }
          set({ playing: false, currentTime: 0 });
        }
        return;
      }
      get().playFromIndex(cur + 1);
    },

    prev: () => {
      const a = audioEl;
      if (!a) return;
      if (a.currentTime > 3) {
        a.currentTime = 0;
        set({ currentTime: 0 });
        return;
      }
      const s = get();
      const prevIdx = s.currentIndex - 1;
      if (prevIdx >= 0) {
        get().playFromIndex(prevIdx);
      } else if (get().current) {
        // At the very start: restart from 0.
        a.currentTime = 0;
        set({ currentTime: 0 });
      }
    },

    seek: (t) => {
      if (!audioEl) return;
      audioEl.currentTime = t;
      set({ currentTime: t });
    },

    setVolume: (v) => {
      const a = ensureAudio();
      const clamped = Math.min(1, Math.max(0, v));
      a.volume = clamped;
      set({ volume: clamped, muted: clamped === 0 });
      try {
        localStorage.setItem(VOLUME_KEY, String(clamped));
      } catch { /* ignore */ }
    },

    setMuted: (m) => {
      const a = ensureAudio();
      a.muted = m;
      set({ muted: m });
    },

    setShuffle: (sh) => {
      const s = get();
      if (sh) {
        set({ shuffle: true, playOrder: buildShuffleOrder(s.queue.length, s.currentIndex) });
      } else {
        set({ shuffle: false, playOrder: null });
      }
    },

    setRepeat: (r) => set({ repeat: r }),

    setFullScreen: (v) => set({ fullScreen: v }),

    removeFromQueue: (orderIndex) => {
      const s = get();
      const order = s.playOrder;
      const real = order ? order[orderIndex] : orderIndex;
      const queue = [...s.queue];
      queue.splice(real, 1);
      let playOrder = order;
      if (playOrder) {
        playOrder = playOrder
          .filter((_, i) => i !== orderIndex)
          .map((v) => (v > real ? v - 1 : v));
      }
      const prevIndex = s.currentIndex;
      let currentIndex = prevIndex;
      if (orderIndex === s.currentIndex) {
        // Removed the playing position: fall to the next position (or stop).
        if (queue.length === 0) {
          audioEl?.pause();
          audioEl?.removeAttribute('src');
          set({ queue: [], currentIndex: -1, current: null, playing: false, playOrder: null });
          return;
        }
        currentIndex = Math.min(prevIndex, (playOrder?.length ?? queue.length) - 1);
      } else if (orderIndex < s.currentIndex) {
        currentIndex = prevIndex - 1;
      }
      const current = currentIndex >= 0 ? queue[realIndex(playOrder, currentIndex)] : null;
      set({ queue, playOrder, currentIndex, current });
    },

    moveInQueue: (from, to) => {
      set((s) => {
        const order = s.playOrder;
        const queue = [...s.queue];
        if (order) {
          const arr = [...order];
          const [v] = arr.splice(from, 1);
          arr.splice(to, 0, v);
          return { queue, playOrder: arr };
        }
        const [moved] = queue.splice(from, 1);
        queue.splice(to, 0, moved);
        return { queue };
      });
    },

    clearQueue: () => {
      if (audioEl) {
        audioEl.pause();
        audioEl.removeAttribute('src');
      }
      set({ queue: [], currentIndex: -1, current: null, playing: false, playOrder: null });
    },
  };
});

// Persist the queue (ids + current position) whenever it changes (non-shuffle
// fast path; the actual order is restored from the DB on init).
let persisting = false;
usePlayerStore.subscribe((s) => {
  if (persisting || s.queue.length === 0) return;
  persisting = true;
  try {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify({
        ids: s.queue.map((t) => t.id),
        index: s.currentIndex,
        currentTime: s.currentTime,
        savedAt: Date.now(),
      }),
    );
  } catch { /* ignore */ } finally {
    persisting = false;
  }
});