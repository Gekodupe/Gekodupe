import type { GeckodupeClient } from '../client.js';
import { idempotencyGuard } from './guard.js';

export interface HonoMiddlewareOptions {
  property?: string;
  getBody?: (c: any) => unknown | Promise<unknown>;
  headerName?: string;
  statusCode?: number;
}

/**
 * Hono middleware. Attach result on c.set('geckodupe', result).
 */
export function createHonoMiddleware(client: GeckodupeClient, options: HonoMiddlewareOptions = {}) {
  const property = options.property || 'geckodupe';
  const statusCode = options.statusCode || 409;
  const guard = idempotencyGuard({
    client,
    headerName: options.headerName,
    getBody:
      options.getBody ||
      (async (c: any) => {
        try {
          return await c.req.json();
        } catch {
          return await c.req.text();
        }
      }),
    getHeader: (c: any, name: string) => c.req.header(name)
  });

  return async function geckodupeHonoMiddleware(c: any, next: () => Promise<void>) {
    const outcome = await guard(c);
    c.set(property, outcome.result);
    if (!outcome.ok) {
      return c.json(outcome.result, statusCode);
    }
    await next();
  };
}
