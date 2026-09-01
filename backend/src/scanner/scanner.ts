import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/index.js';
import * as lib from '../db/library.js';
import { extractMetadata, deriveTitleFromFilename, SUPPORTED_EXTENSIONS } from './metadata.js';
import { cacheArtwork } from './artwork.js';
import config from '../config.js';

/**
 * Library scanner.
 *
 * Strategy for handling modified/deleted/moved files without re-reading
 * everything: we retain a map of existing track id → file_path in memory and
 * walk the configured folders. Files whose (size, mtime) already match are
 * left untouched. New files are fully parsed. Missing files are deleted.
 *
 * Concurrency: the scan runs in-process and streams writes into SQLite within
 * a single transaction so the library stays consistent.
 */

/** Check for sidecar .lrc or .txt lyrics file next to an audio file. */
function hasSidecarLyrics(audioPath: string): boolean {
  const base = audioPath.slice(0, audioPath.lastIndexOf('.'));
  try {
    return fs.existsSync(`${base}.lrc`) || fs.existsSync(`${base}.txt`);
  } catch {
    return false;
  }
}

export interface ScanProgress {
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  phase: 'idle' | 'scanning' | 'cleaning' | 'done' | 'error';
  filesScanned: number;
  filesFound: number;
  filesNew: number;
  filesUpdated: number;
  filesDeleted: number;
  errors: number;
  currentFile: string | null;
  message: string;
}

const progress: ScanProgress = {
  running: false,
  startedAt: null,
  finishedAt: null,
  phase: 'idle',
  filesScanned: 0,
  filesFound: 0,
  filesNew: 0,
  filesUpdated: 0,
  filesDeleted: 0,
  errors: 0,
  currentFile: null,
  message: 'Idle',
};

export function getScanProgress(): ScanProgress {
  return { ...progress };
}

export function isScanning(): boolean {
  return progress.running;
}

/** Recursively collect all supported audio file paths under root. */
async function walk(dir: string, out: string[]): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    progress.errors += 1;
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden dirs and common non-music junk.
      if (entry.name.startsWith('.')) continue;
      if (['node_modules', 'tmp', 'temp', 'cache'].includes(entry.name.toLowerCase())) continue;
      await walk(full, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).slice(1).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) out.push(full);
    }
  }
}

/** Report a file's stable identity for change detection: (size, mtimeMs). */
function fileIdentity(p: string): { size: number; mtime: number } | null {
  try {
    const st = fs.statSync(p);
    return { size: st.size, mtime: Math.floor(st.mtimeMs) };
  } catch {
    return null;
  }
}

/** Extract artist/album/genre ids from raw metadata, creating records as needed. */
function resolveIds(meta: Awaited<ReturnType<typeof extractMetadata>>, artworkRel: string | null) {
  const db = getDb();
  const artistName = (meta.artist ?? '').trim();
  const albumName = (meta.album ?? '').trim();
  const albumArtistName = (meta.albumArtist ?? artistName ?? '').trim();
  const genreName = (meta.genre ?? '').trim();

  let artistId: number | null = null;
  if (artistName) artistId = lib.findOrCreateArtist(artistName);

  let albumId: number | null = null;
  if (albumName) {
    albumId = lib.findOrCreateAlbum({
      title: albumName,
      artistId,
      albumArtist: albumArtistName || null,
      year: meta.year,
      totalTracks: null,
      totalDiscs: null,
      artworkPath: artworkRel,
    });
    // Attach genre to album (many-to-many) for album-level genre browsing.
    if (genreName && albumId) {
      const genreId = lib.findOrCreateGenre(genreName);
      db.prepare('INSERT OR IGNORE INTO album_genres (album_id, genre_id) VALUES (?, ?)').run(albumId, genreId);
    }
  }

  let genreId: number | null = null;
  if (genreName) genreId = lib.findOrCreateGenre(genreName);

  return { artistId, albumId, genreId };
}

/**
 * Run a full library scan. Resolves when complete.
 */
export async function scanLibrary(): Promise<ScanProgress> {
  if (progress.running) return progress;
  progress.running = true;
  progress.startedAt = Date.now();
  progress.finishedAt = null;
  progress.phase = 'scanning';
  progress.filesScanned = 0;
  progress.filesFound = 0;
  progress.filesNew = 0;
  progress.filesUpdated = 0;
  progress.filesDeleted = 0;
  progress.errors = 0;
  progress.currentFile = null;
  progress.message = 'Scanning music folders…';

  const db = getDb();
  const root = config.musicPath;

  try {
    // Snapshot existing paths → id, and existing stats for change detection.
    const existing = new Map<string, number>();
    const existingTracks = db.prepare(
      'SELECT id, file_path, file_size, mtime_ms FROM tracks',
    ).all() as Array<{ id: number; file_path: string; file_size: number | null; mtime_ms: number | null }>;
    for (const t of existingTracks) existing.set(t.file_path, t.id);

    // Collect candidate files.
    const files: string[] = [];
    if (fs.existsSync(root)) {
      await walk(root, files);
    }
    progress.filesFound = files.length;
    progress.message = 'Reading and updating tracks…';

    // Phase 1 (async): walk + parse metadata for new/modified files. Writing is
    // deferred to a synchronous transaction afterwards (better-sqlite3
    // transactions are synchronous).
    type PendingRow = { file: string; existingId: number | undefined; row: Record<string, unknown> };
    const pending: PendingRow[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      progress.currentFile = file;
      progress.filesScanned += 1;

      const ident = fileIdentity(file);
      if (!ident) continue;

      const existingId = existing.get(file);
      if (existingId !== undefined) {
        const prev = existingTracks.find((t) => t.id === existingId);
        if (prev && prev.file_size === ident.size && prev.mtime_ms === ident.mtime) {
          // Unchanged — keep lookups cheap, skip re-parse.
          existing.delete(file);
          continue;
        }
      }

      try {
        const meta = await extractMetadata(file);
        const artworkRel = meta.artworkBuffer
          ? (cacheArtwork(meta.artworkBuffer)?.path ?? null)
          : null;

        const { artistId, albumId, genreId } = resolveIds(meta, artworkRel);

        const title = (meta.title ?? '').trim() || deriveTitleFromFilename(file);
        pending.push({
          file,
          existingId,
          row: {
            file_path: file,
            file_name: path.basename(file),
            file_ext: path.extname(file).slice(1).toLowerCase(),
            file_size: ident.size,
            mtime_ms: ident.mtime,
            title,
            artist_id: artistId,
            album_id: albumId,
            genre_id: genreId,
            track_number: meta.trackNumber ?? null,
            disc_number: meta.discNumber ?? null,
            year: meta.year ?? null,
            composer: meta.composer ?? null,
            duration: meta.duration ?? null,
            bitrate: meta.bitrate ?? null,
            sample_rate: meta.sampleRate ?? null,
            bit_depth: meta.bitDepth ?? null,
            codec: meta.codec ?? null,
            has_artwork: artworkRel ? 1 : 0,
            has_lyrics: meta.hasLyrics || hasSidecarLyrics(file) ? 1 : 0,
            normalized: title.trim().toLowerCase(),
            content_hash: `${ident.size}-${ident.mtime}`,
          },
        });
        // Resolve created artist/album/genre records → their ids.
        // (resolveIds already inserted them; ids were resolved inside.)
      } catch {
        progress.errors += 1;
      }
    }

    // Phase 2 (sync): apply all pending writes inside one transaction.
    const scanTx = db.transaction((list: PendingRow[]) => {
      for (const { file, existingId, row } of list) {
        if (existingId !== undefined) {
          lib.updateTrack(existingId, row);
          progress.filesUpdated += 1;
        } else {
          lib.insertTrack(row);
          progress.filesNew += 1;
        }
        existing.delete(file);
      }
    });
    scanTx(pending);

    // Delete any DB rows whose files are no longer present (deleted/moved).
    progress.phase = 'cleaning';
    progress.message = 'Removing deleted or moved files…';
    const deleteTx = db.transaction((ids: number[]) => {
      const stmt = db.prepare('DELETE FROM tracks WHERE id = ?');
      for (const id of ids) stmt.run(id);
    });
    const orphanIds = [...existing.values()];
    if (orphanIds.length > 0) deleteTx(orphanIds);
    progress.filesDeleted = orphanIds.length;

    progress.phase = 'done';
    progress.finishedAt = Date.now();
    progress.message = `Scan complete: ${progress.filesNew} new, ${progress.filesUpdated} updated, ${progress.filesDeleted} removed`;
    return { ...progress };
  } catch (err) {
    progress.phase = 'error';
    progress.message = err instanceof Error ? err.message : 'Scan failed';
    return { ...progress };
  } finally {
    progress.running = false;
    progress.currentFile = null;
  }
}
