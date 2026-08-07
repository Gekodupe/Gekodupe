/**
 * Express — reject double-submits / retries / spam with one middleware.
 *
 *   npm i express geckodupe
 *   GECKODUPE_API_KEY=... node examples/express.mjs
 */
import express from 'express';
import { createClient, createExpressMiddleware } from 'geckodupe';

const gecko = createClient({ apiKey: process.env.GECKODUPE_API_KEY });
const app = express();
app.use(express.json());

app.post('/submit', createExpressMiddleware(gecko), (req, res) => {
  res.json({ ok: true, fingerprint: req.geckodupe.fingerprint });
});

app.listen(3000, () => console.log('listening on :3000'));
