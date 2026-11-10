import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';
import { getDb, getSetting, setSetting } from './db/index.js';

const KEY_MUSIC_PATH = 'music_path';
const KEY_SPICY_KEY = 'spicy_lyrics_key';

/** Apply persisted settings over the environment defaults. Call once at startup. */
export function loadPersistedSettings(): void {
  const saved = getSetting(KEY_MUSIC_PATH);
  if (saved) config.musicPath = saved;
}

/** Validate and persist the music folder. Throws an Error with a user-facing message. */
export function setMusicPath(input: string): string {
  const resolved = path.resolve(input.trim());
  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw new Error(`Folder not found: ${resolved}`);
  }
  if (!stat.isDirectory()) throw new Error(`Not a folder: ${resolved}`);
  try {
    fs.accessSync(resolved, fs.constants.R_OK);
  } catch {
    throw new Error(`Cannot read folder: ${resolved}`);
  }
  setSetting(KEY_MUSIC_PATH, resolved);
  config.musicPath = resolved;
  return resolved;
}

/** The Spicy Lyrics API key, or null. Never sent to the browser. */
export function getSpicyKey(): string | null {
  const v = getSetting(KEY_SPICY_KEY);
  return v && v.length > 0 ? v : null;
}

/** Save (or clear, with null/empty) the Spicy Lyrics key. */
export function setSpicyKey(key: string | null): void {
  const clean = (key ?? '').trim();
  setSetting(KEY_SPICY_KEY, clean);
  // A new key (or none) can change the answer for tracks that had no lyrics.
  getDb().prepare("DELETE FROM lyrics_cache WHERE status = 'none'").run();
}
