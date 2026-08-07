/**
 * Bun.serve - Idempotency-Key aware event check.
 *
 *   GECKODUPE_API_KEY=... bun examples/bun.mjs
 */
import { createClient, idempotencyGuard } from 'geckodupe';

const gecko = createClient({ apiKey: process.env.GECKODUPE_API_KEY });
const guard = idempotencyGuard({
  client: gecko,
  getBody: async (req) => {
    try {
      return await req.json();
    } catch {
      return await req.text();
    }
  },
  getHeader: (req, name) => req.headers.get(name) || undefined
});

Bun.serve({
  port: 3000,
  async fetch(req) {
    if (req.method !== 'POST') return new Response('ok');
    const outcome = await guard(req);
    if (!outcome.ok) {
      return Response.json(outcome.result, { status: 409 });
    }
    return Response.json({ ok: true, fingerprint: outcome.result.fingerprint });
  }
});
