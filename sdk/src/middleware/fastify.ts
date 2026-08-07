import type { GeckodupeClient } from '../client.js';
import { idempotencyGuard } from './guard.js';

export interface FastifyPluginOptions {
  property?: string;
  getBody?: (req: any) => unknown;
  headerName?: string;
  statusCode?: number;
}

/**
 * Fastify preHandler-style plugin factory.
 * Usage: fastify.addHook('preHandler', createFastifyPlugin(client))
 */
export function createFastifyPlugin(client: GeckodupeClient, options: FastifyPluginOptions = {}) {
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

  return async function geckodupeFastifyPreHandler(req: any, reply: any) {
    const outcome = await guard(req);
    (req as any)[property] = outcome.result;
    if (!outcome.ok) {
      return reply.code(statusCode).send(outcome.result);
    }
  };
}
