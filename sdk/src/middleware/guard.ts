import type { GeckodupeClient } from '../client.js';
import type { EventCheckResult } from '../types.js';

export interface IdempotencyGuardOptions {
  client: GeckodupeClient;
  /** Extract body/payload for fingerprinting. */
  getBody: (req: unknown) => unknown | Promise<unknown>;
  /** Header that carries an explicit event / idempotency key. Default: Idempotency-Key */
  headerName?: string;
  /** Optional: read a header value from the framework request. */
  getHeader?: (req: unknown, name: string) => string | undefined;
  /** Called when the event is a duplicate or blocked. Default status semantics: 409. */
  onReject?: (result: EventCheckResult, req: unknown) => unknown | Promise<unknown>;
}

function toEventInput(body: unknown, eventId?: string) {
  if (eventId && (body == null || body === '')) return { eventId };
  if (typeof body === 'string') return { text: body, eventId };
  if (body && typeof body === 'object') {
    return { fields: body as Record<string, string>, text: JSON.stringify(body), eventId };
  }
  return { text: String(body || ''), eventId };
}

/**
 * Generic idempotency guard for Bun, Workers, Node, or any framework.
 * Normalize → fingerprint → compare recent / eventId on the Geckodupe API.
 */
export function idempotencyGuard(opts: IdempotencyGuardOptions) {
  const headerName = opts.headerName || 'Idempotency-Key';

  return async function runGuard(req: unknown): Promise<
    | { ok: true; result: EventCheckResult }
    | { ok: false; result: EventCheckResult; response?: unknown }
  > {
    const body = await opts.getBody(req);
    const eventId = opts.getHeader ? opts.getHeader(req, headerName) : undefined;
    const result = await opts.client.checkEvent(toEventInput(body, eventId));
    if (result.duplicate || result.decision === 'block') {
      const response = opts.onReject ? await opts.onReject(result, req) : undefined;
      return { ok: false, result, response };
    }
    return { ok: true, result };
  };
}
