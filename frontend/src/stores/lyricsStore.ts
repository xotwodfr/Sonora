import { create } from 'zustand';
import { api } from '../lib/api';
import { parseLrc } from '../lib/lrc';
import { usePlayerStore } from './playerStore';

export interface ParsedLyrics {
  synced: boolean;
  lines: Array<{ time: number; text: string }> | null;
  plainText: string | null;
}

interface LyricsState {
  lyricsOpen: boolean;
  currentLyrics: ParsedLyrics | null;
  loading: boolean;
  activeLineIndex: number;
  /** Whether auto-follow is currently suspended by user scrolling */
  autoFollowSuspended: boolean;
  /** Timestamp when auto-follow was suspended (for re-enable timeout) */
  suspendedAt: number | null;

  setLyricsOpen: (v: boolean) => void;
  fetchLyrics: (trackId: number) => Promise<void>;
  computeActiveLine: (currentTime: number) => void;
  clearLyrics: () => void;

  /** Suspend auto-follow when user manually scrolls */
  suspendAutoFollow: () => void;
  /** Resume auto-follow (e.g., on line click) */
  resumeAutoFollow: () => void;
  /** Seek to a specific lyric line's timestamp */
  seekToLine: (lineIndex: number) => void;
}

/** Cache: trackId → parsed lyrics. Avoids re-fetching when switching back. */
const cache = new Map<number, ParsedLyrics>();

export const useLyricsStore = create<LyricsState>((set, get) => ({
  lyricsOpen: false,
  currentLyrics: null,
  loading: false,
  activeLineIndex: -1,
  autoFollowSuspended: false,
  suspendedAt: null,

  setLyricsOpen: (v) => set({ lyricsOpen: v }),

  fetchLyrics: async (trackId: number) => {
    // Check cache first.
    const cached = cache.get(trackId);
    if (cached) {
      set({ currentLyrics: cached, loading: false });
      return;
    }

    set({ loading: true, currentLyrics: null });
    try {
      const raw = await api.getLyrics(trackId);
      if (!raw) {
        const empty: ParsedLyrics = { synced: false, lines: null, plainText: null };
        cache.set(trackId, empty);
        set({ currentLyrics: empty, loading: false });
        return;
      }

      let parsed: ParsedLyrics;
      if (raw.synced && Array.isArray(raw.lines) && raw.lines.length > 0) {
        // Normalize synced lines: ensure each has a valid time (number) and text (string).
        const lines = raw.lines
          .map((l) => ({
            time: typeof l.time === 'number' ? l.time : 0,
            text: typeof l.text === 'string' ? l.text : '',
          }))
          .filter((l) => l.text.length > 0);
        if (lines.length > 0) {
          parsed = { synced: true, lines, plainText: null };
        } else if (raw.plainText && typeof raw.plainText === 'string') {
          const lrcLines = parseLrc(raw.plainText);
          parsed = lrcLines.length > 0
            ? { synced: true, lines: lrcLines, plainText: null }
            : { synced: false, lines: null, plainText: raw.plainText };
        } else {
          parsed = { synced: false, lines: null, plainText: null };
        }
      } else if (typeof raw.plainText === 'string' && raw.plainText.length > 0) {
        // Check if unsynced text is actually LRC format
        const lrcLines = parseLrc(raw.plainText);
        if (lrcLines.length > 0) {
          parsed = { synced: true, lines: lrcLines, plainText: null };
        } else {
          parsed = { synced: false, lines: null, plainText: raw.plainText };
        }
      } else {
        parsed = { synced: false, lines: null, plainText: null };
      }

      cache.set(trackId, parsed);
      set({ currentLyrics: parsed, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  computeActiveLine: (currentTime: number) => {
    const { currentLyrics } = get();
    if (!currentLyrics?.synced || !currentLyrics.lines) return;
    const lines = currentLyrics.lines;
    // Find the last line whose time <= currentTime
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime) idx = i;
      else break;
    }
    if (idx !== get().activeLineIndex) {
      console.log(`[lyrics computeActiveLine] idx=${idx} prev=${get().activeLineIndex}`);
      set({ activeLineIndex: idx });
    }
  },

  clearLyrics: () => set({
    currentLyrics: null,
    loading: false,
    activeLineIndex: -1,
    autoFollowSuspended: false,
    suspendedAt: null,
  }),

  suspendAutoFollow: () => {
    set({ autoFollowSuspended: true, suspendedAt: Date.now() });
  },

  resumeAutoFollow: () => {
    set({ autoFollowSuspended: false, suspendedAt: null });
  },

  seekToLine: (lineIndex: number) => {
    const { currentLyrics } = get();
    if (!currentLyrics?.synced || !currentLyrics.lines) return;
    const line = currentLyrics.lines[lineIndex];
    if (!line) return;

    // Use the global player seek
    usePlayerStore.getState().seek(line.time);

    // Resume auto-follow on click
    set({ autoFollowSuspended: false, suspendedAt: null });
  },
}));

// ---- Auto-fetch lyrics when the current track changes ----
let prevTrackId: number | null = null;

usePlayerStore.subscribe((state) => {
  const track = state.current;
  const trackId = track?.id ?? null;
  if (trackId !== prevTrackId) {
    prevTrackId = trackId;
    if (trackId !== null) {
      useLyricsStore.getState().fetchLyrics(trackId);
    } else {
      useLyricsStore.getState().clearLyrics();
    }
  }
});

// ---- Sync active line with playback position ----
let rafId: number | null = null;

function startSyncLoop() {
  if (rafId !== null) return;
  console.log('[lyrics] startSyncLoop called');
  const tick = () => {
    const currentTime = usePlayerStore.getState().currentTime;
    const s = useLyricsStore.getState();
    console.log(`[lyrics tick] time=${currentTime.toFixed(2)} activeIdx=${s.activeLineIndex} lines=${s.currentLyrics?.lines?.length}`);
    s.computeActiveLine(currentTime);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function stopSyncLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// Start the sync loop when lyrics are open, stop when closed.
useLyricsStore.subscribe((state) => {
  // DEBUG: expose state for browser inspection
  if (typeof window !== 'undefined') {
    (window as any).__lyricsStore = {
      lyricsOpen: state.lyricsOpen,
      synced: state.currentLyrics?.synced,
      linesCount: state.currentLyrics?.lines?.length,
      activeLineIndex: state.activeLineIndex,
      loading: state.loading,
    };
  }
  if (state.lyricsOpen && state.currentLyrics?.synced) {
    startSyncLoop();
  } else {
    stopSyncLoop();
  }
});
