import type { GeckodupeClient } from '../client.js';
import { idempotencyGuard } from './guard.js';
import type { EventCheckResult } from '../types.js';

export interface ExpressMiddlewareOptions {
  /** Where to attach the check result: req.geckodupe */
  property?: string;
  getBody?: (req: any) => unknown;
  headerName?: string;
  statusCode?: number;
}

/**
 * Express middleware: rejects duplicate / blocked submissions with 409 by default.
 */
export function createExpressMiddleware(client: GeckodupeClient, options: ExpressMiddlewareOptions = {}) {
  const property = options.property || 'geckodupe';
  const statusCode = options.statusCode || 409;
  const guard = idempotencyGuard({
    client,
    headerName: options.headerName,
    getBody: options.getBody || ((req: any) => req.body),
    getHeader: (req: unknown, name: string) => {
      const r = req as { headers?: Record<string, string | string[] | undefined> };
      const v = r.headers?.[name.toLowerCase()] ?? r.headers?.[name];
      return Array.isArray(v) ? v[0] : v;
    }
  });

  return async function geckodupeExpressMiddleware(req: any, res: any, next: (err?: unknown) => void) {
    try {
      const outcome = await guard(req);
      req[property] = outcome.result;
      if (!outcome.ok) {
        return res.status(statusCode).json(outcome.result);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export type { EventCheckResult };
