# Lyrics Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add synchronized and unsynchronized lyrics to every playback UI in Sonora through a shared backend API, Zustand store, and React component.

**Architecture:** Backend extracts lyrics from embedded metadata or sidecar files and serves them via `GET /api/tracks/:id/lyrics`. Frontend uses a Zustand store (`lyricsStore`) that auto-fetches lyrics when the track changes and computes the active line from playback position. A single `LyricsView` component renders inside the full-screen player; mini and small players open full-screen with lyrics active.

**Tech Stack:** Express + better-sqlite3 + music-metadata (backend), React 18 + Zustand + Framer Motion + Tailwind CSS + lucide-react (frontend).

## Global Constraints

- All lyrics must stay local — no external API calls for lyrics
- Extraction priority: embedded → `.lrc` sidecar → `.txt` sidecar
- `has_lyrics` boolean flag in DB; lyrics content fetched on-demand
- Single shared `LyricsView`, `lyricsStore`, and API endpoint — no duplication
- Framer Motion for animations, `prefers-reduced-motion` respected
- All lyrics controls keyboard accessible and screen-reader friendly
- Glass UI system: use `glass-control`, `glass-strong`, CSS tokens from `index.css`
- Icons from `lucide-react` only

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/src/db/schema.ts` | Edit | Add migration 3: `has_lyrics` column |
| `backend/src/db/library.ts` | Edit | Add `has_lyrics` to `TrackRow`, `TRACK_SELECT`, `insertTrack`, `updateTrack` |
| `backend/src/scanner/metadata.ts` | Edit | Return `hasLyrics` from `extractMetadata()` |
| `backend/src/scanner/scanner.ts` | Edit | Check sidecar files, pass `has_lyrics` to insert/update |
| `backend/src/routes/tracks.ts` | Edit | Add `GET /:id/lyrics` endpoint |
| `frontend/src/lib/api.ts` | Edit | Add `getLyrics()` API method |
| `frontend/src/lib/lrc.ts` | Create | LRC parser utility |
| `frontend/src/stores/lyricsStore.ts` | Create | Shared lyrics state + sync logic |
| `frontend/src/components/player/LyricsView.tsx` | Create | Shared lyrics display component |
| `frontend/src/components/player/FullScreenPlayer.tsx` | Edit | Add lyrics toggle + responsive layout |
| `frontend/src/components/layout/MobileDock.tsx` | Edit | Add lyrics button |
| `frontend/src/components/layout/NowPlayingBar.tsx` | Edit | Add lyrics button |

---

### Task 1: Backend — Database Migration for `has_lyrics`

**Files:**
- Modify: `backend/src/db/schema.ts`

**Interfaces:**
- Produces: migration 3 that adds `has_lyrics INTEGER DEFAULT 0` to tracks table

- [ ] **Step 1: Add migration 3 to schema.ts**

Open `backend/src/db/schema.ts` and append a third entry to the `MIGRATIONS` array, after the existing migration 2:

```typescript
{
  id: 3,
  name: 'has-lyrics-column',
  sql: `
    ALTER TABLE tracks ADD COLUMN has_lyrics INTEGER DEFAULT 0;
  `,
},
```

- [ ] **Step 2: Verify migration syntax**

Run: `cd backend && npx tsx -e "import { MIGRATIONS } from './src/db/schema.js'; console.log(MIGRATIONS.length, MIGRATIONS.map(m => m.id))"`
Expected: `3 [ 1, 2, 3 ]`

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "feat(backend): add has_lyrics migration"
```

---

### Task 2: Backend — Add `has_lyrics` to Track Queries

**Files:**
- Modify: `backend/src/db/library.ts`

**Interfaces:**
- Consumes: migration 3 from Task 1 (column exists in DB)
- Produces: `TrackRow.has_lyrics` field, included in all track SELECTs

- [ ] **Step 1: Add `has_lyrics` to `TrackRow` interface**

In `backend/src/db/library.ts`, add `has_lyrics: number;` to the `TrackRow` interface after `has_artwork: number;`:

```typescript
export interface TrackRow {
  id: number;
  file_path: string;
  title: string | null;
  artist: string | null;
  artist_id: number | null;
  album: string | null;
  album_id: number | null;
  genre: string | null;
  genre_id: number | null;
  album_artist: string | null;
  track_number: number | null;
  disc_number: number | null;
  year: number | null;
  composer: string | null;
  duration: number | null;
  bitrate: number | null;
  sample_rate: number | null;
  bit_depth: number | null;
  codec: string | null;
  has_artwork: number;
  has_lyrics: number;
  album_artwork: string | null;
  favorite: number;
  added_at: number;
  modified_at: number;
}
```

- [ ] **Step 2: Add `has_lyrics` to `TRACK_SELECT`**

In the `TRACK_SELECT` constant, add `t.has_lyrics,` after `t.has_artwork,`:

```typescript
const TRACK_SELECT = `
  SELECT
    t.id,
    t.file_path,
    t.title,
    a.name AS artist,
    t.artist_id,
    al.title AS album,
    t.album_id,
    g.name AS genre,
    t.genre_id,
    al.album_artist,
    t.track_number,
    t.disc_number,
    t.year,
    t.composer,
    t.duration,
    t.bitrate,
    t.sample_rate,
    t.bit_depth,
    t.codec,
    t.has_artwork,
    t.has_lyrics,
    al.artwork_path AS album_artwork,
    CASE WHEN f.track_id IS NOT NULL THEN 1 ELSE 0 END AS favorite,
    t.added_at,
    t.modified_at
  FROM tracks t
  LEFT JOIN artists a ON a.id = t.artist_id
  LEFT JOIN albums al ON al.id = t.album_id
  LEFT JOIN genres g ON g.id = t.genre_id
  LEFT JOIN favorites f ON f.track_id = t.id
`;
```

- [ ] **Step 3: Add `has_lyrics` to `insertTrack`**

In the `insertTrack` function, add `has_lyrics` to both the column list and VALUES list:

```typescript
export function insertTrack(data: Record<string, unknown>): number {
  const info = getDb().prepare(
    `INSERT INTO tracks (
       file_path, file_name, file_ext, file_size, mtime_ms, title,
       artist_id, album_id, genre_id, track_number, disc_number, year,
       composer, duration, bitrate, sample_rate, bit_depth, codec,
       has_artwork, has_lyrics, normalized, content_hash, added_at, modified_at
     ) VALUES (
       @file_path, @file_name, @file_ext, @file_size, @mtime_ms, @title,
       @artist_id, @album_id, @genre_id, @track_number, @disc_number, @year,
       @composer, @duration, @bitrate, @sample_rate, @bit_depth, @codec,
       @has_artwork, @has_lyrics, @normalized, @content_hash,
       strftime('%s','now'), strftime('%s','now')
     )`,
  ).run(data);
  return Number(info.lastInsertRowid);
}
```

- [ ] **Step 4: Add `has_lyrics` to `updateTrack` allowed list**

In the `updateTrack` function, add `'has_lyrics'` to the `allowed` array after `'has_artwork'`:

```typescript
export function updateTrack(id: number, data: Record<string, unknown>): void {
  const allowed = [
    'file_name', 'file_ext', 'file_size', 'mtime_ms', 'title',
    'artist_id', 'album_id', 'genre_id', 'track_number', 'disc_number', 'year',
    'composer', 'duration', 'bitrate', 'sample_rate', 'bit_depth', 'codec',
    'has_artwork', 'has_lyrics', 'normalized', 'content_hash',
  ];
  // ... rest unchanged
}
```

- [ ] **Step 5: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/library.ts
git commit -m "feat(backend): add has_lyrics to track queries and insert/update"
```

---

### Task 3: Backend — Lyrics Detection in Metadata Extraction

**Files:**
- Modify: `backend/src/scanner/metadata.ts`

**Interfaces:**
- Produces: `ExtractedMetadata.hasLyrics: boolean` — whether embedded lyrics were found

- [ ] **Step 1: Add `hasLyrics` to `ExtractedMetadata`**

In `backend/src/scanner/metadata.ts`, add `hasLyrics: boolean;` to the interface after `artworkBuffer: Buffer | null;`:

```typescript
export interface ExtractedMetadata {
  title: string | null;
  artist: string | null;
  albumArtist: string | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  composer: string | null;
  duration: number | null;
  bitrate: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  codec: string | null;
  hasArtwork: boolean;
  artworkBuffer: Buffer | null;
  hasLyrics: boolean;
}
```

- [ ] **Step 2: Detect embedded lyrics in `extractMetadata()`**

At the end of the `extractMetadata()` function, before the `return` statement, add lyrics detection. The `music-metadata` library provides `common.lyrics` (array of strings from USLT frames):

```typescript
  // Lyrics: check for embedded lyrics in metadata tags.
  const lyrics = common.lyrics as string[] | undefined;
  const hasLyrics = Array.isArray(lyrics) && lyrics.some((l) => l && l.trim().length > 0);

  return {
    title: typeof common.title === 'string' ? common.title : null,
    artist: typeof common.artist === 'string' ? common.artist : null,
    // ... all existing fields unchanged ...
    hasArtwork,
    artworkBuffer,
    hasLyrics,
  };
```

- [ ] **Step 3: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors (the return object must include `hasLyrics`)

- [ ] **Step 4: Commit**

```bash
git add backend/src/scanner/metadata.ts
git commit -m "feat(backend): detect embedded lyrics during metadata extraction"
```

---

### Task 4: Backend — Sidecar File Detection + Scanner Integration

**Files:**
- Modify: `backend/src/scanner/scanner.ts`

**Interfaces:**
- Consumes: `extractMetadata()` returns `hasLyrics` (Task 3)
- Produces: `has_lyrics` written to DB for each track during scan

- [ ] **Step 1: Add sidecar detection helper**

At the top of `backend/src/scanner/scanner.ts`, after the imports, add a helper function:

```typescript
/** Check for sidecar .lrc or .txt lyrics file next to an audio file. */
function hasSidecarLyrics(audioPath: string): boolean {
  const base = audioPath.slice(0, audioPath.lastIndexOf('.'));
  try {
    return fs.existsSync(`${base}.lrc`) || fs.existsSync(`${base}.txt`);
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Add `has_lyrics` to the pending row in `scanLibrary()`**

In the `scanLibrary()` function, inside the `try` block where `pending.push()` is called, add `has_lyrics` to the row object. After the `has_artwork: artworkRel ? 1 : 0,` line:

```typescript
        pending.push({
          file,
          existingId,
          row: {
            // ... all existing fields ...
            has_artwork: artworkRel ? 1 : 0,
            has_lyrics: meta.hasLyrics || hasSidecarLyrics(file) ? 1 : 0,
            normalized: title.trim().toLowerCase(),
            content_hash: `${ident.size}-${ident.mtime}`,
          },
        });
```

- [ ] **Step 3: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/scanner/scanner.ts
git commit -m "feat(backend): detect sidecar lyrics files during scan"
```

---

### Task 5: Backend — Lyrics API Endpoint

**Files:**
- Modify: `backend/src/routes/tracks.ts`

**Interfaces:**
- Consumes: `getTrack(id)` returns `TrackRow` with `file_path` and `has_lyrics`
- Produces: `GET /api/tracks/:id/lyrics` endpoint returning parsed lyrics

- [ ] **Step 1: Add imports at the top of tracks.ts**

Add `fs` and `path` imports (already present), and add a `parseFile` import from music-metadata for on-demand lyrics reading:

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import { Router } from 'express';
import { getDb } from '../db/index.js';
import { getTrack } from '../db/library.js';
import { parsePaging, parseSort, sendPaged, ok, notFound, asyncHandler } from '../api/helpers.js';
```

- [ ] **Step 2: Add LRC parser helper**

Add a helper function to parse LRC format, before the `export default router;` line:

```typescript
/** Parse LRC format lyrics into timed lines. */
function parseLrc(content: string): Array<{ time: number; text: string }> {
  const lines: Array<{ time: number; text: string }> = [];
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  for (const raw of content.split('\n')) {
    const times: number[] = [];
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(raw)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] ?? '0';
      const ms = parseInt(msStr.padEnd(3, '0'), 10);
      times.push(min * 60 + sec + ms / 1000);
    }
    if (times.length === 0) continue;
    const text = raw.replace(/\[\d{1,2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
    for (const time of times) {
      lines.push({ time, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

/** Try to read sidecar lyrics file (.lrc or .txt). */
function readSidecarLyrics(audioPath: string): { synced: boolean; content: string } | null {
  const base = audioPath.slice(0, audioPath.lastIndexOf('.'));
  for (const ext of ['lrc', 'txt']) {
    const candidate = `${base}.${ext}`;
    try {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, 'utf-8');
        return { synced: ext === 'lrc', content };
      }
    } catch {
      // continue
    }
  }
  return null;
}
```

- [ ] **Step 3: Add the lyrics route**

Add the route BEFORE the `export default router;` line. It must come after `/:id/artwork` to avoid route conflicts:

```typescript
/** GET /api/tracks/:id/lyrics — on-demand lyrics for the current track. */
router.get('/:id/lyrics', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const row = getTrack(id);
  if (!row || !row.file_path) return notFound(res, 'Track not found');

  // 1. Try embedded lyrics from the audio file.
  try {
    const meta = await parseFile(row.file_path, { skipCovers: true, duration: false });
    const common = (meta?.common ?? {}) as Record<string, unknown>;

    // Synced lyrics (SyLT frame)
    const synced = common.syncedLyrics as Array<{ time: number; text: string }> | undefined;
    if (Array.isArray(synced) && synced.length > 0) {
      return ok(res, { synced: true, lines: synced.map((s) => ({ time: s.time / 1000, text: s.text })), plainText: null });
    }

    // Plain lyrics (USLT frame)
    const lyrics = common.lyrics as string[] | undefined;
    if (Array.isArray(lyrics) && lyrics.length > 0) {
      const text = lyrics.join('\n').trim();
      if (text.length > 0) {
        // Check if the text itself is LRC format
        const parsed = parseLrc(text);
        if (parsed.length > 0) {
          return ok(res, { synced: true, lines: parsed, plainText: null });
        }
        return ok(res, { synced: false, lines: null, plainText: text });
      }
    }
  } catch {
    // File may be unavailable — fall through to sidecar check.
  }

  // 2. Try sidecar .lrc / .txt file.
  const sidecar = readSidecarLyrics(row.file_path);
  if (sidecar) {
    if (sidecar.synced) {
      const parsed = parseLrc(sidecar.content);
      if (parsed.length > 0) {
        return ok(res, { synced: true, lines: parsed, plainText: null });
      }
    }
    const text = sidecar.content.trim();
    if (text.length > 0) {
      return ok(res, { synced: false, lines: null, plainText: text });
    }
  }

  // 3. No lyrics found.
  return ok(res, null);
}));
```

- [ ] **Step 4: Verify typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/tracks.ts
git commit -m "feat(backend): add GET /api/tracks/:id/lyrics endpoint"
```

---

### Task 6: Frontend — API Client for Lyrics

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `api.getLyrics(trackId)` returning `LyricsResponse | null`

- [ ] **Step 1: Add `LyricsLine` and `LyricsResponse` types**

At the top of `frontend/src/lib/api.ts`, after the existing imports, add:

```typescript
export interface LyricsLine {
  time: number;
  text: string;
}

export interface LyricsResponse {
  synced: boolean;
  lines: LyricsLine[] | null;
  plainText: string | null;
}
```

- [ ] **Step 2: Add `getLyrics` to the `api` object**

Inside the `api` object, after the `recordPlay` method, add:

```typescript
  // ---- Lyrics ----
  getLyrics: (trackId: number) => reqEnvelope<LyricsResponse | null>(`/api/tracks/${trackId}/lyrics`),
```

- [ ] **Step 3: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(frontend): add lyrics API client method"
```

---

### Task 7: Frontend — LRC Parser Utility

**Files:**
- Create: `frontend/src/lib/lrc.ts`

**Interfaces:**
- Produces: `parseLrc(content: string): Array<{ time: number; text: string }>`

- [ ] **Step 1: Create the LRC parser**

Create `frontend/src/lib/lrc.ts`:

```typescript
/**
 * Parse standard LRC format lyrics into timed lines.
 *
 * Handles:
 * - Standard timestamps: [MM:SS.xx]
 * - Extended timestamps: [MM:SS.xxx]
 * - Multiple timestamps per line
 * - Metadata tags [ti:Title], [ar:Artist], etc. (skipped — no time value)
 * - Lines without timestamps (skipped)
 *
 * Returns lines sorted by time ascending.
 */
export function parseLrc(content: string): Array<{ time: number; text: string }> {
  const lines: Array<{ time: number; text: string }> = [];
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const raw of content.split('\n')) {
    const times: number[] = [];
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;

    while ((match = regex.exec(raw)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] ?? '0';
      const ms = parseInt(msStr.padEnd(3, '0'), 10);
      times.push(min * 60 + sec + ms / 1000);
    }

    if (times.length === 0) continue;

    const text = raw.replace(/\[\d{1,2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
    for (const time of times) {
      lines.push({ time, text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/lrc.ts
git commit -m "feat(frontend): add LRC parser utility"
```

---

### Task 8: Frontend — Lyrics Zustand Store

**Files:**
- Create: `frontend/src/stores/lyricsStore.ts`

**Interfaces:**
- Consumes: `api.getLyrics(trackId)` (Task 6), `parseLrc()` (Task 7), `usePlayerStore` (existing)
- Produces: `useLyricsStore` with `lyricsOpen`, `currentLyrics`, `loading`, `activeLineIndex`, `setLyricsOpen`, `fetchLyrics`

- [ ] **Step 1: Create the lyrics store**

Create `frontend/src/stores/lyricsStore.ts`:

```typescript
import { create } from 'zustand';
import { api, type LyricsResponse } from '../lib/api';
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
  setLyricsOpen: (v: boolean) => void;
  fetchLyrics: (trackId: number) => Promise<void>;
  computeActiveLine: (currentTime: number) => void;
  clearLyrics: () => void;
}

/** Cache: trackId → parsed lyrics. Avoids re-fetching when switching back. */
const cache = new Map<number, ParsedLyrics>();

export const useLyricsStore = create<LyricsState>((set, get) => ({
  lyricsOpen: false,
  currentLyrics: null,
  loading: false,
  activeLineIndex: -1,

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
      if (raw.synced && raw.lines) {
        // If the backend returned raw LRC text in plainText, parse it on the client.
        parsed = { synced: true, lines: raw.lines, plainText: null };
      } else if (raw.plainText) {
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
      set({ activeLineIndex: idx });
    }
  },

  clearLyrics: () => set({ currentLyrics: null, loading: false, activeLineIndex: -1 }),
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
  const tick = () => {
    const currentTime = usePlayerStore.getState().currentTime;
    useLyricsStore.getState().computeActiveLine(currentTime);
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
  if (state.lyricsOpen && state.currentLyrics?.synced) {
    startSyncLoop();
  } else {
    stopSyncLoop();
  }
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/lyricsStore.ts
git commit -m "feat(frontend): add lyrics Zustand store with auto-fetch and sync"
```

---

### Task 9: Frontend — LyricsView Component

**Files:**
- Create: `frontend/src/components/player/LyricsView.tsx`

**Interfaces:**
- Consumes: `useLyricsStore` (Task 8)
- Produces: `<LyricsView />` component rendered inside FullScreenPlayer

- [ ] **Step 1: Create the LyricsView component**

Create `frontend/src/components/player/LyricsView.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MicOff } from 'lucide-react';
import { useLyricsStore } from '../../stores/lyricsStore';

/** Shared lyrics display — rendered inside the full-screen player. */
export function LyricsView() {
  const currentLyrics = useLyricsStore((s) => s.currentLyrics);
  const loading = useLyricsStore((s) => s.loading);
  const activeLineIndex = useLyricsStore((s) => s.activeLineIndex);
  const lyricsOpen = useLyricsStore((s) => s.lyricsOpen);

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
        <SyncedLyrics lines={currentLyrics.lines} activeIndex={activeLineIndex} />
      )}
      {!loading && currentLyrics && !currentLyrics.synced && currentLyrics.plainText && (
        <UnsyncedLyrics text={currentLyrics.plainText} />
      )}
    </motion.div>
  );
}

/** Synced lyrics: each line highlights and scrolls with playback position. */
function SyncedLyrics({
  lines,
  activeIndex,
}: {
  lines: Array<{ time: number; text: string }>;
  activeIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLParagraphElement>>(new Map());

  // Smooth scroll the active line into view.
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = lineRefs.current.get(activeIndex);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6"
      style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)' }}
    >
      <div className="flex flex-col items-center gap-3 pb-24 pt-8">
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
              aria-current={isActive ? 'true' : undefined}
              className={`w-full text-center text-lg leading-relaxed transition-all duration-300 ${
                isActive
                  ? 'scale-105 font-semibold text-[var(--text)]'
                  : isPast
                    ? 'text-[var(--text-tertiary)]'
                    : 'text-[var(--text-secondary)]'
              }`}
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
```

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/player/LyricsView.tsx
git commit -m "feat(frontend): add LyricsView component with synced/unsynced/empty states"
```

---

### Task 10: Frontend — FullScreenPlayer Lyrics Integration

**Files:**
- Modify: `frontend/src/components/player/FullScreenPlayer.tsx`

**Interfaces:**
- Consumes: `useLyricsStore` (Task 8), `LyricsView` (Task 9)
- Produces: Lyrics toggle button in top bar, responsive lyrics layout

- [ ] **Step 1: Add imports**

At the top of `FullScreenPlayer.tsx`, add `Captions` to the lucide-react import and import the lyrics store and view:

```typescript
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
import { useLyricsStore } from '../../stores/lyricsStore';
import { LyricsView } from './LyricsView';
```

- [ ] **Step 2: Add lyrics store selectors**

Inside the `FullScreenPlayer` function, after the existing store selectors, add:

```typescript
  const lyricsOpen = useLyricsStore((s) => s.lyricsOpen);
  const setLyricsOpen = useLyricsStore((s) => s.setLyricsOpen);
```

- [ ] **Step 3: Add lyrics toggle button to the top bar**

In the top bar section, after the queue button and before the favorite button, add:

```typescript
          <button
            type="button"
            onClick={() => setLyricsOpen(!lyricsOpen)}
            aria-label={lyricsOpen ? 'Hide lyrics' : 'Show lyrics'}
            aria-pressed={lyricsOpen}
            className={`glass-control h-10 w-10 ${lyricsOpen ? 'is-on' : ''}`}
          >
            <Captions className="h-5 w-5" strokeWidth={1.9} />
          </button>
```

- [ ] **Step 4: Restructure the main content area for lyrics**

Replace the existing main content `<div>` (the one with `className="relative z-10 flex h-[calc(100%-7rem)] flex-col items-center justify-center gap-8 px-6 pb-10 lg:flex-row lg:gap-16 lg:px-16"`) with a version that conditionally shows lyrics:

```typescript
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
        <AnimatePresence>
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
        </AnimatePresence>

        {/* Meta + controls */}
        <div className="flex w-full max-w-lg flex-col items-center gap-5 lg:items-start">
          {/* ... existing meta + controls section unchanged ... */}
        </div>
      </div>
```

- [ ] **Step 5: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/player/FullScreenPlayer.tsx
git commit -m "feat(frontend): add lyrics toggle and responsive layout to full-screen player"
```

---

### Task 11: Frontend — Mini Player (MobileDock) Lyrics Button

**Files:**
- Modify: `frontend/src/components/layout/MobileDock.tsx`

**Interfaces:**
- Consumes: `useLyricsStore` (Task 8), `usePlayerStore` (existing)
- Produces: Lyrics button in mini player that opens full-screen with lyrics active

- [ ] **Step 1: Add imports**

At the top of `MobileDock.tsx`, add `Captions` to the lucide-react import and import the lyrics store:

```typescript
import { Captions, ChevronUp, Disc3, Home, ListMusic, Music2, Pause, Play, Search, SkipForward } from 'lucide-react';
import { useLyricsStore } from '../../stores/lyricsStore';
```

- [ ] **Step 2: Add lyrics store selector**

Inside the `MobileDock` function, after the existing store selectors, add:

```typescript
  const setLyricsOpen = useLyricsStore((s) => s.setLyricsOpen);
```

- [ ] **Step 3: Add lyrics button between skip and expand**

In the mini player section, between the skip-forward button and the expand (ChevronUp) button, add:

```typescript
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
```

- [ ] **Step 4: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/MobileDock.tsx
git commit -m "feat(frontend): add lyrics button to mini player (MobileDock)"
```

---

### Task 12: Frontend — Small Player (NowPlayingBar) Lyrics Button

**Files:**
- Modify: `frontend/src/components/layout/NowPlayingBar.tsx`

**Interfaces:**
- Consumes: `useLyricsStore` (Task 8), `usePlayerStore` (existing)
- Produces: Lyrics button in small/compact player that opens full-screen with lyrics active

- [ ] **Step 1: Add imports**

At the top of `NowPlayingBar.tsx`, add `Captions` to the lucide-react import and import the lyrics store:

```typescript
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
import { useLyricsStore } from '../../stores/lyricsStore';
```

- [ ] **Step 2: Add lyrics store selector**

Inside the `NowPlayingBar` function, after the existing store selectors, add:

```typescript
  const setLyricsOpen = useLyricsStore((s) => s.setLyricsOpen);
```

- [ ] **Step 3: Add lyrics button in the right section**

In the right section of the NowPlayingBar, after the queue button and before the volume controls, add:

```typescript
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
```

- [ ] **Step 4: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/NowPlayingBar.tsx
git commit -m "feat(frontend): add lyrics button to small player (NowPlayingBar)"
```

---

### Task 13: Integration Testing with Playwright

**Files:**
- None created — uses existing Playwright MCP tools for verification

**Interfaces:**
- Consumes: All tasks 1-12 complete, backend running, frontend running

- [ ] **Step 1: Start the backend and frontend**

```bash
cd backend && npm run dev &
cd frontend && npm run dev &
```

Wait for both to report ready.

- [ ] **Step 2: Test mini player lyrics button**

Navigate to the app. Play a track. At mobile viewport (< lg):
- Find the mini player (MobileDock)
- Verify a button with `aria-label="Show lyrics"` exists
- Click it
- Verify the full-screen player opens
- Verify `role="region"` with `aria-label="Lyrics"` is visible

- [ ] **Step 3: Test small player lyrics button**

At desktop viewport (≥ lg):
- Find the NowPlayingBar
- Verify a button with `aria-label="Show lyrics"` exists
- Click it
- Verify the full-screen player opens with lyrics visible

- [ ] **Step 4: Test full-screen player lyrics toggle**

- In the full-screen player, find the button with `aria-label="Hide lyrics"` or `aria-label="Show lyrics"`
- Click to toggle lyrics off — verify the lyrics region disappears
- Click to toggle lyrics on — verify the lyrics region reappears
- Verify the button has `aria-pressed="true"` when lyrics are open

- [ ] **Step 5: Test lyrics display for tracks with lyrics**

- Play a track that has embedded lyrics or a sidecar .lrc file
- Open lyrics
- Verify text lines are rendered
- Verify one line has `aria-current="true"` (the active line)
- Verify the active line has `font-semibold` in its computed style

- [ ] **Step 6: Test lyrics display for tracks without lyrics**

- Play a track with no lyrics
- Open lyrics
- Verify "Lyrics unavailable" text is visible
- Verify the `MicOff` icon is rendered

- [ ] **Step 7: Test track switching with lyrics open**

- Open lyrics on track A
- Verify lyrics for track A are displayed
- Skip to track B
- Verify lyrics update to track B (no stale lyrics from track A)

- [ ] **Step 8: Verify no regressions**

- Navigate to Albums, Artists, Playlists, Songs, Favorites, Genres pages
- Verify they load without errors
- Play a track from each page
- Verify playback works
- Open the queue panel
- Verify queue functions correctly
- Use search overlay
- Verify search works

- [ ] **Step 9: Check computed styles on lyrics**

- Open synced lyrics
- Find the active line (has `aria-current="true"`)
- Verify its computed color matches `var(--text)` (the accent/active color)
- Find a non-active line
- Verify its computed color matches `var(--text-secondary)` or `var(--text-tertiary)`

- [ ] **Step 10: Verify keyboard accessibility**

- Tab to each lyrics button
- Verify focus ring is visible (outline: 2px solid var(--focus-ring))
- Press Enter on the lyrics button
- Verify it toggles lyrics
- Tab through the full-screen player controls
- Verify all interactive elements are focusable

---

## Summary

| Task | Description | Files |
|---|---|---|
| 1 | DB migration: `has_lyrics` column | `schema.ts` |
| 2 | Add `has_lyrics` to track queries | `library.ts` |
| 3 | Lyrics detection in metadata extraction | `metadata.ts` |
| 4 | Sidecar file detection + scanner integration | `scanner.ts` |
| 5 | Lyrics API endpoint | `tracks.ts` |
| 6 | Frontend API client for lyrics | `api.ts` |
| 7 | LRC parser utility | `lrc.ts` (new) |
| 8 | Lyrics Zustand store | `lyricsStore.ts` (new) |
| 9 | LyricsView component | `LyricsView.tsx` (new) |
| 10 | FullScreenPlayer lyrics integration | `FullScreenPlayer.tsx` |
| 11 | Mini player lyrics button | `MobileDock.tsx` |
| 12 | Small player lyrics button | `NowPlayingBar.tsx` |
| 13 | Integration testing | Playwright |
