import type { Request, Response } from 'express';
import { getDb } from '../db/index.js';

/** Parse and normalize a pagination + sort request. */
export function parsePaging(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(query.limit ?? '50'), 10) || 50));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export const SORT_COLUMNS: Record<string, string> = {
  title: 'title',
  artist: 'artist',
  album: 'album',
  genre: 'genre',
  year: 'year',
  duration: 'duration',
  track_number: 'track_number',
  added_at: 'added_at',
  created_at: 'created_at',
  updated_at: 'updated_at',
  played_at: 'played_at',
  name: 'name',
};

/**
 * Whitelist a sort request. `map` lets each route supply fully-qualified SQL
 * expressions (table aliased) to avoid ambiguous column errors on joins.
 */
export function parseSort(
  query: Record<string, unknown>,
  allow: string[],
  map: Record<string, string> = SORT_COLUMNS,
): { col: string; dir: string } {
  const raw = String(query.sort ?? '');
  const [name, ...rest] = raw.split(':');
  const direction = (rest[0] ?? 'asc').toUpperCase() === 'desc' ? 'DESC' : 'ASC';
  const key = name || allow[0];
  if (allow.includes(key) && map[key]) {
    const base = map[key];
    // Escape-injection-safe: only whitelisted raw column names are accepted.
    return { col: /COLLATE\s+NOCASE/i.test(base) ? base : `${base}`, dir: direction };
  }
  return { col: map[allow[0]] ?? 'id', dir: 'ASC' };
}

/** Send a paginated JSON envelope. */
export function sendPaged(res: Response, rows: unknown[], total: number, page: number, limit: number) {
  return res.json({
    data: rows,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}

/** Count helper that reuses a WHERE fragment. */
export function countWhere(where: string, params: unknown[]): number {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) AS c FROM (${where})`).get(...params) as { c: number };
  return row.c;
}

export function ok(res: Response, data: unknown = {}) {
  return res.json({ data });
}

export function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: message });
}

export function notFound(res: Response, message = 'Not found') {
  return res.status(404).json({ error: message });
}

export function serverError(res: Response, err: unknown) {
  console.error('[api]', err);
  const message = err instanceof Error ? err.message : 'Internal error';
  return res.status(500).json({ error: message });
}

export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<unknown>,
) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err) => serverError(res, err));
  };
}
