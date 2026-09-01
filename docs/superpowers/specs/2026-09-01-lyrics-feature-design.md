# Lyrics Feature Design Spec

**Date:** 2026-09-01
**Status:** Approved
**Scope:** Full lyrics feature across all playback UIs in Sonora

---

## 1. Overview

Add a lyrics feature to Sonora that displays synchronized (LRC) and unsynchronized lyrics for the currently playing track. Lyrics are available from every player surface through a shared implementation: a single `LyricsView` component, a single `lyricsStore`, and a single backend API endpoint.

## 2. Audit — Player Surfaces

Every component that displays the currently-playing track and has playback controls:

| Component | File | Breakpoint | Lyrics Integration |
|---|---|---|---|
| `MobileDock` | `components/layout/MobileDock.tsx` | `< lg` | Lyrics button → opens full-screen with lyrics active |
| `NowPlayingBar` | `components/layout/NowPlayingBar.tsx` | `≥ lg` | Lyrics button → opens full-screen with lyrics active |
| `FullScreenPlayer` | `components/player/FullScreenPlayer.tsx` | overlay | Lyrics toggle + inline lyrics view |

Non-player surfaces (TrackRow, SearchOverlay, AlbumCard, PlaylistCard, detail pages) are playback triggers only — they do not persistently display the playing track and do not need lyrics controls.

## 3. Backend

### 3.1 New API Endpoint

**`GET /api/tracks/:id/lyrics`**

Response when lyrics exist (synced):
```json
{
  "data": {
    "synced": true,
    "lines": [
      { "time": 0.0, "text": "First line" },
      { "time": 3.5, "text": "Second line" }
    ],
    "plainText": null
  }
}
```

Response when lyrics exist (unsynced):
```json
{
  "data": {
    "synced": false,
    "lines": null,
    "plainText": "Line one\nLine two\nLine three"
  }
}
```

Response when no lyrics exist:
```json
{ "data": null }
```

### 3.2 Lyrics Extraction Priority

All local — no external API calls:

1. **Embedded lyrics** from audio file metadata (`music-metadata` provides `common.lyrics` for USLT frames and SyLT for synchronized lyrics)
2. **Sidecar `.lrc` file** — same directory, same basename as the audio file (e.g., `song.flac` → `song.lrc`)
3. **Sidecar `.txt` file** — same directory, same basename (e.g., `song.flac` → `song.txt`)

### 3.3 Scanner Update

**New migration (id: 3):** Add `has_lyrics INTEGER DEFAULT 0` column to `tracks` table.

During the scan (`extractMetadata` + scanner), after reading audio metadata:
- Check `common.lyrics` from music-metadata — if present and non-empty, set `has_lyrics = 1`
- Check for sidecar `.lrc` / `.txt` files next to the audio file — if found, set `has_lyrics = 1`
- Do NOT store lyrics content in the database — only the boolean flag

The `has_lyrics` flag is used by the frontend for quick UI decisions (e.g., whether to show the lyrics button as enabled). The actual lyrics content is fetched on-demand via the API.

### 3.4 Files Changed (Backend)

| File | Change |
|---|---|
| `backend/src/db/schema.ts` | Add migration 3: `ALTER TABLE tracks ADD COLUMN has_lyrics INTEGER DEFAULT 0` |
| `backend/src/db/library.ts` | Include `has_lyrics` in track SELECT queries |
| `backend/src/scanner/metadata.ts` | Return `hasLyrics` boolean from `extractMetadata()` |
| `backend/src/scanner/scanner.ts` | Check sidecar files, write `has_lyrics` during scan |
| `backend/src/routes/tracks.ts` | Add `GET /:id/lyrics` route |

## 4. Frontend

### 4.1 Lyrics Store (`stores/lyricsStore.ts`)

Zustand store managing shared lyrics state:

```typescript
interface LyricsState {
  lyricsOpen: boolean;
  currentLyrics: ParsedLyrics | null;
  loading: boolean;
  activeLineIndex: number;
  setLyricsOpen: (v: boolean) => void;
  fetchLyrics: (trackId: number) => Promise<void>;
  computeActiveLine: (currentTime: number) => void;
}

interface ParsedLyrics {
  synced: boolean;
  lines: Array<{ time: number; text: string }> | null;
  plainText: string | null;
}
```

**Track change listener:** Subscribes to `playerStore.current`. When the track changes, automatically calls `fetchLyrics(newTrack.id)` for the new track. If lyrics are open, the view updates seamlessly.

**Active line computation:** A `requestAnimationFrame` loop reads `playerStore.currentTime` and finds the last line whose `time ≤ currentTime`. Updates `activeLineIndex` for smooth scroll tracking.

**Caching:** Lyrics are cached per track ID in a `Map<number, ParsedLyrics>` to avoid re-fetching when switching back to a recently played track.

### 4.2 LRC Parser (`lib/lrc.ts`)

Parses standard LRC format:
```
[00:12.34] Line text
[01:23.456] Another line
```

Returns `Array<{ time: number; text: string }>` sorted by time.

Handles:
- Standard LRC timestamps `[MM:SS.xx]`
- Extended timestamps `[MM:SS.xxx]`
- Lines without timestamps (ignored for synced output)
- Metadata tags `[ti:Title]`, `[ar:Artist]`, etc. (ignored)

### 4.3 LyricsView Component (`components/player/LyricsView.tsx`)

Shared component rendered inside FullScreenPlayer when `lyricsOpen === true`.

**Synced lyrics:**
- Each line rendered as a `<p>` element with a ref
- Active line: `text-accent`, `font-semibold`, subtle scale transform
- Non-active lines: `text-secondary`, reduced opacity
- Smooth scroll: `scrollIntoView({ behavior: 'smooth', block: 'center' })` triggered when `activeLineIndex` changes
- Uses `aria-current="true"` on the active line for screen readers

**Unsynced lyrics:**
- All lines rendered as plain text
- No highlighting, no scroll tracking
- Clean display with `text-secondary` color

**Empty state:** When `currentLyrics === null` and not loading — shows "Lyrics unavailable" with a `MicOff` icon.

**Loading state:** Skeleton shimmer matching line layout.

### 4.4 FullScreenPlayer Integration

**New state:** `lyricsOpen` from `lyricsStore`.

**Top bar:** Add a lyrics toggle button (icon: `Captions` from lucide-react) next to queue and favorite buttons. When lyrics are open, button shows `is-on` state.

**Layout when lyrics are open:**
- **Desktop (lg+):** Two-column — artwork (left, reduced size) + lyrics panel (right, scrollable)
- **Mobile:** Artwork shrinks to a small thumbnail above the lyrics, or lyrics overlay the artwork area
- Meta + controls section stays at the bottom

**Animation:** Lyrics panel uses Framer Motion `AnimatePresence` — slides in from the right (desktop) or fades in (mobile). `prefers-reduced-motion` is respected (Framer Motion inherits this).

**Keyboard:** Escape does NOT close lyrics (it closes the full-screen player). The lyrics toggle button is keyboard accessible.

### 4.5 MobileDock Integration (Mini Player)

Add a lyrics button (icon: `Captions`, small size) between the skip-forward and expand buttons.

On click: `setFullScreen(true)` + `setLyricsOpen(true)` — opens full-screen with lyrics already visible.

`aria-label="Show lyrics"`, keyboard Enter/Space support.

### 4.6 NowPlayingBar Integration (Small/Compact Player)

Add a lyrics button in the right section (near queue toggle, volume, expand).

On click: `setFullScreen(true)` + `setLyricsOpen(true)` — same behavior.

`aria-label="Show lyrics"`, keyboard Enter/Space support.

### 4.7 Files Changed (Frontend)

| File | Change |
|---|---|
| `frontend/src/stores/lyricsStore.ts` | **Create** — shared lyrics state |
| `frontend/src/lib/lrc.ts` | **Create** — LRC parser |
| `frontend/src/components/player/LyricsView.tsx` | **Create** — shared lyrics display |
| `frontend/src/components/player/FullScreenPlayer.tsx` | **Edit** — add lyrics toggle + layout |
| `frontend/src/components/layout/MobileDock.tsx` | **Edit** — add lyrics button |
| `frontend/src/components/layout/NowPlayingBar.tsx` | **Edit** — add lyrics button |
| `frontend/src/lib/api.ts` | **Edit** — add `getLyrics(trackId)` API method |

## 5. Accessibility

- All lyrics buttons: `aria-label`, `role="button"`, keyboard Enter/Space
- Lyrics panel: `role="region"`, `aria-label="Lyrics"`, `aria-live="polite"` announces track changes
- Active line: `aria-current="true"` for screen readers
- Focus management: toggle button retains focus when lyrics open (no focus trap — it's a view toggle, not a modal)
- Smooth transitions: `prefers-reduced-motion` respected via Framer Motion's built-in support
- Active line highlight: CSS transition on color + transform (300ms ease)

## 6. Animations

- **Lyrics panel open/close:** Framer Motion `AnimatePresence` with `initial/animate/exit` — slide from right (desktop) or fade (mobile), 300ms ease-out
- **Active line transition:** CSS `transition: color 300ms, transform 300ms` on the line element
- **Smooth scroll:** Native `scrollIntoView({ behavior: 'smooth' })` — browser handles the animation
- **Lyrics button state:** CSS transition on color/background for the `is-on` toggle state

## 7. Responsive Behavior

- **Desktop (lg+):** Full-screen player shows artwork and lyrics side-by-side. Lyrics panel takes ~40% width.
- **Tablet/mobile:** Full-screen player stacks artwork (smaller) above lyrics, or artwork becomes a small thumbnail. Lyrics panel takes full width.
- **Mini player (mobile):** Just the lyrics button — no lyrics display inline.

## 8. Testing Plan

After implementation:

1. **Mini player lyrics button** — verify button renders, is keyboard accessible, opens full-screen with lyrics active
2. **Small player lyrics button** — same verification on desktop viewport
3. **Full-screen player lyrics toggle** — verify toggle shows/hides lyrics, button state reflects open/closed
4. **Track switching with lyrics open** — verify lyrics update when track changes, no stale lyrics shown
5. **Synced LRC playback** — verify active line highlights and scrolls in real-time with playback position
6. **Unsynced lyrics** — verify plain text display without timestamp behavior
7. **Tracks without lyrics** — verify "Lyrics unavailable" state shows correctly
8. **Lyrics API** — verify endpoint returns correct response for synced, unsynced, and missing lyrics
9. **DOM inspection** — verify aria labels, roles, aria-current on active line
10. **Computed styles** — verify accent color on active line, opacity on non-active lines
11. **Text assertions** — verify lyrics text renders, empty state text renders
12. **No regressions** — verify playback, queue, library, albums, artists, playlists, favorites, search all still work
