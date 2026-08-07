/**
 * Hono - middleware for spam + event dedupe.
 *
 *   npm i hono geckodupe
 *   GECKODUPE_API_KEY=... node examples/hono.mjs
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createClient, createHonoMiddleware } from 'geckodupe';

const gecko = createClient({ apiKey: process.env.GECKODUPE_API_KEY });
const app = new Hono();

app.post('/form', createHonoMiddleware(gecko), (c) => {
  return c.json({ ok: true, fingerprint: c.get('geckodupe').fingerprint });
});

serve({ fetch: app.fetch, port: 3000 });
