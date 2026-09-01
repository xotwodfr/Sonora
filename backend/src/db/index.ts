import Database from 'better-sqlite3';
import config from '../config.js';
import { MIGRATIONS } from './schema.js';

/**
 * Singleton SQLite connection. Opened in WAL mode for concurrent reads while
 * the scanner writes, with foreign keys enforced.
 */
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');

  migrate(db);
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id      INTEGER PRIMARY KEY,
      name    TEXT NOT NULL,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

  const applied = new Set<number>(
    (database.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: number }>).map((r) => r.id),
  );

  const run = database.transaction(() => {
    for (const m of MIGRATIONS) {
      if (applied.has(m.id)) continue;
      database.exec(m.sql);
      database.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)').run(m.id, m.name);
    }
  });

  run();
  console.log(`[db] schema ready (${MIGRATIONS.length} migrations)`);
}

/** Export a handle to the connection so consumers don't need to import db directly. */
export const dbHandle = {
  get(): Database.Database {
    return getDb();
  },
};

/** Read a settings value. */
export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}

// Initialize the connection eagerly so import-time callers work.
getDb();

export default getDb;
