import type { NextFunction, Request, Response } from 'express';

/**
 * Protection for the desktop app's localhost server. Other programs and
 * websites on the same machine can reach 127.0.0.1, so:
 *  - Host must be the loopback address we listen on (stops DNS rebinding);
 *  - requests that change state must come from our own page (or no browser at all).
 */
export function localOnlyGuard(port: () => number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const p = port();
    const allowedHosts = new Set([`127.0.0.1:${p}`, `localhost:${p}`]);
    if (!allowedHosts.has(String(req.headers.host ?? '').toLowerCase())) {
      res.status(403).json({ error: 'Forbidden host' });
      return;
    }
    const origin = req.headers.origin;
    if (origin && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      if (origin !== `http://127.0.0.1:${p}` && origin !== `http://localhost:${p}`) {
        res.status(403).json({ error: 'Forbidden origin' });
        return;
      }
    }
    next();
  };
}
