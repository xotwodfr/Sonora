/**
 * SQLite schema for Sonora.
 *
 * Design notes:
 *  - Normalized relational tables for tracks / artists / albums / genres.
 *  - Foreign keys with indexes on every join column so large libraries stay
 *    fast without table scans.
 *  - WAL mode + foreign_keys pragma enabled at connection time.
 *  - A single `schema_migrations` table drives idempotent migrations. There is
 *    currently one migration (the initial schema); future changes append new
 *    migrations rather than mutating existing ones.
 */

export const MIGRATIONS: Array<{ id: number; name: string; sql: string }> = [
  {
    id: 1,
    name: 'initial-schema',
    sql: `
      CREATE TABLE IF NOT EXISTS genres (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE
      );

      CREATE TABLE IF NOT EXISTS artists (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        name      TEXT NOT NULL COLLATE NOCASE,
        sort_name TEXT COLLATE NOCASE,
        normalized TEXT COLLATE NOCASE,
        artwork_path TEXT,
        UNIQUE (normalized)
      );
      CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS albums (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        title         TEXT NOT NULL COLLATE NOCASE,
        artist_id     INTEGER,
        album_artist  TEXT COLLATE NOCASE,
        year          INTEGER,
        total_tracks  INTEGER,
        total_discs   INTEGER,
        artwork_path  TEXT,
        normalized    TEXT COLLATE NOCASE
      );
      CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id);
      CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_albums_year ON albums(year);

      CREATE TABLE IF NOT EXISTS tracks (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path    TEXT NOT NULL,
        file_name    TEXT,
        file_ext     TEXT,
        file_size    INTEGER,
        mtime_ms     INTEGER,
        title        TEXT,
        artist_id    INTEGER,
        album_id     INTEGER,
        genre_id     INTEGER,
        track_number INTEGER,
        disc_number  INTEGER,
        year         INTEGER,
        composer     TEXT,
        duration     REAL,
        bitrate      INTEGER,
        sample_rate  INTEGER,
        bit_depth    INTEGER,
        codec        TEXT,
        has_artwork  INTEGER DEFAULT 0,
        normalized   TEXT COLLATE NOCASE,
        content_hash TEXT,
        added_at     INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        modified_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
        FOREIGN KEY (album_id)  REFERENCES albums(id)  ON DELETE SET NULL,
        FOREIGN KEY (genre_id)  REFERENCES genres(id)  ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_path ON tracks(file_path);
      CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_tracks_album_pos
        ON tracks(album_id, disc_number, track_number);

      CREATE TABLE IF NOT EXISTS playlists (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        description TEXT,
        artwork_path TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL,
        track_id    INTEGER NOT NULL,
        position    INTEGER NOT NULL,
        added_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE CASCADE,
        UNIQUE (playlist_id, position)
      );
      CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position);
      CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);

      CREATE TABLE IF NOT EXISTS favorites (
        track_id  INTEGER PRIMARY KEY,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS play_history (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id   INTEGER NOT NULL,
        played_at  INTEGER NOT NULL,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_play_history_track ON play_history(track_id);
      CREATE INDEX IF NOT EXISTS idx_play_history_time ON play_history(played_at);

      -- recently_played is a denormalized app-level list (distinct tracks,
      -- latest occurrence) backed by play_history; kept as its own table for
      -- cheap reads and to allow manual pinning/removal later.
      CREATE TABLE IF NOT EXISTS recently_played (
        track_id   INTEGER PRIMARY KEY,
        played_at  INTEGER NOT NULL,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS folders (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        path     TEXT NOT NULL UNIQUE,
        label    TEXT,
        enabled  INTEGER NOT NULL DEFAULT 1,
        scanned_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `,
  },
  {
    id: 2,
    name: 'album_genres',
    sql: `
      CREATE TABLE IF NOT EXISTS album_genres (
        album_id INTEGER NOT NULL,
        genre_id INTEGER NOT NULL,
        PRIMARY KEY (album_id, genre_id),
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
        FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
      );
    `,
  },
  {
    id: 3,
    name: 'has-lyrics-column',
    sql: `
      ALTER TABLE tracks ADD COLUMN has_lyrics INTEGER DEFAULT 0;
    `,
  },
];
