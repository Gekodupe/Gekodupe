/**
 * Cloudflare Worker fetch handler - still only needs a Geckodupe API key.
 * You do not deploy Geckodupe's Worker; you call ours.
 *
 *   GECKODUPE_API_KEY secret on your Worker
 */
import { createClient, idempotencyGuard } from 'geckodupe';

export default {
  async fetch(request, env) {
    const gecko = createClient({ apiKey: env.GECKODUPE_API_KEY });
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

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const outcome = await guard(request);
    if (!outcome.ok) {
      return Response.json(outcome.result, { status: 409 });
    }
    return Response.json({ ok: true, fingerprint: outcome.result.fingerprint });
  }
};
