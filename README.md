# Sonora

A local music streaming and library app — think Apple Music for your own files.

Point it at a folder of music, and Sonora scans, indexes, and lets you browse
your library by album, artist, genre, or playlist, with full playback, search,
shuffle, repeat, and a full-screen player.

## Quick start (Docker)

```bash
# 1. Clone and enter the project
git clone https://github.com/xotwodfr/Sonora.git

cd Sonora

# 2. Drop your music somewhere (or symlink an existing folder)
mkdir -p music
# cp -r /path/to/your/music/* music/

# 3. Launch everything
docker compose up -d --build

# 4. Open http://localhost:3000 in your browser
```

Sonora will scan your `music/` folder automatically on first launch. Hit the
**Rescan** button in the header to pick up new files at any time.

### What gets persisted

| Volume          | Contents                                  |
|-----------------|-------------------------------------------|
| `sonora-data`   | SQLite database + artwork cache            |

Your music files are mounted read-only — Sonora never writes to them.

## Local development

Requires Node 22+ and ffmpeg installed on the host.

```bash
# Backend
cd backend
npm install
npm run dev            # → http://localhost:8787

# Frontend (separate terminal)
cd frontend
npm install
MUSIC_PATH=/path/to/music DATA_PATH=/tmp/sonora-data npm run dev
                       # → http://localhost:5173 (proxies /api to :8787)
```

## Desktop app (Windows .exe)

Sonora also ships as a standalone desktop app: pick a folder, it plays from there.
No Docker, no setup.

1. Run `Sonora-<version>-portable.exe` (no installer; your library, playlists and
   settings are kept in `%APPDATA%\Sonora`).
2. Click **Choose music folder** and select the folder your music is in. Sonora
   reads it in place and never changes your files.

The app is not code-signed, so Windows SmartScreen may warn on first run: choose
**More info → Run anyway**.

### Lyrics

Sonora shows synced or plain lyrics from, in order of priority:

1. **Local files** next to the track with the same name: `.ttml` (including
   word-by-word), `.lrc` (including enhanced LRC) and `.txt`; or lyrics embedded in
   the file's tags. Time-synced local lyrics always win.
2. **[Spicy Lyrics](https://developers.spicylyrics.org)**, if you add your API key in
   **Settings → Lyrics**. Each track is matched to its Spotify track by title, artist,
   album and length (only exact matches are accepted, so a live or remix version never
   gets the wrong timings), then its lyrics are fetched and cached. Online lyrics are
   credited under the lyrics, as Spicy Lyrics requires.
3. Plain-text local lyrics (`.txt`) if nothing better exists.

The key is stored on your computer only and sent only to `api.spicylyrics.org`.

### Building the .exe

Needs Node 22+. From the repo root (works on Linux, macOS or Windows):

```bash
cd desktop
npm install
npm run dist:win        # -> desktop/dist/Sonora-<version>-portable.exe
npm start               # run the desktop app without packaging
```

## Project structure

```
Sonora/
├── backend/            Express + SQLite + ffmpeg scanner
│   ├── src/
│   │   ├── db/         schema + migrations
│   │   ├── routes/     REST endpoints
│   │   ├── scanner/    music file scanner
│   │   └── index.ts    entry point
│   └── Dockerfile
├── desktop/            Electron shell + packaging for the Windows .exe
├── frontend/           React + Vite + Tailwind SPA
│   ├── src/
│   │   ├── components/ layout, player, cards, tracks, UI
│   │   ├── pages/      route pages
│   │   ├── stores/     Zustand state
│   │   └── lib/        API client, types, helpers
│   ├── nginx.conf      production SPA config
│   └── Dockerfile
├── docker-compose.yml  two-service stack
└── README.md
```

## Environment variables

| Variable     | Default              | Description                         |
|--------------|----------------------|-------------------------------------|
| `MUSIC_PATH` | `/music` (Docker)    | Path to music folder to scan (the desktop app lets you pick it in the UI) |
| `DATA_PATH`  | `/data` (Docker)     | Writable dir for SQLite + cache     |
| `PORT`       | `8787`               | Backend listen port                 |
| `HOSTNAME`   | `0.0.0.0` (Docker)   | Backend bind address                |

## Tech stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Zustand, Lucide icons
- **Backend** — Node, Express, better-sqlite3, music-metadata, ffmpeg
- **Infra** — Docker Compose, nginx (SPA + reverse proxy)

## License

MIT
