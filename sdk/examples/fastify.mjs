/**
 * Fastify — preHandler idempotency guard.
 *
 *   npm i fastify geckodupe
 *   GECKODUPE_API_KEY=... node examples/fastify.mjs
 */
import Fastify from 'fastify';
import { createClient, createFastifyPlugin } from 'geckodupe';

const gecko = createClient({ apiKey: process.env.GECKODUPE_API_KEY });
const app = Fastify();

app.addHook('preHandler', createFastifyPlugin(gecko));

app.post('/webhook', async (req) => {
  return { ok: true, fingerprint: req.geckodupe.fingerprint };
});

await app.listen({ port: 3000 });
