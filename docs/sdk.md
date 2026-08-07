# SDK (npm)

Package name: **`geckodupe`**

```bash
npm install geckodupe
```

Default API base: `https://geckodupe-spam.nic-58f.workers.dev`

## createClient

```js
import { createClient } from 'geckodupe';

const gecko = createClient({
  apiKey: process.env.GECKODUPE_API_KEY,
  // baseUrl: 'https://geckodupe-spam.nic-58f.workers.dev',
  // timeoutMs: 30000,
});
```

### Methods

| Method | Hosted path | Use |
|--------|-------------|-----|
| `gecko.score(input)` | `POST /v1/spam/score` | Score spam risk |
| `gecko.clean(input)` | `POST /v1/spam/clean` | Despam text / list |
| `gecko.check(input)` | `POST /v1/spam/check` | Score + burst memory |
| `gecko.checkEvent(input)` | `POST /v1/events/check` | Idempotency / retries |
| `gecko.getBlocklist()` | `GET /v1/spam/blocklist` | Read tenant blocklist |
| `gecko.putBlocklist(list)` | `PUT /v1/spam/blocklist` | Replace blocklist |

`input` can be a string, a `{ text }`, or a `{ fields }` object. For forms, prefer `fields`.

## Local helpers (no network)

```js
import { normalize, fingerprint, scorePayload, cleanText } from 'geckodupe';

const norm = normalize(raw);
const fp = fingerprint(fields, { mode: 'form' });
const score = scorePayload(fields, { mode: 'form' });
const cleaned = cleanText(dump, { mode: 'list' });
```

Use these in tests, Electron main, or offline pipelines. Hosted burst memory still needs `check` / `checkEvent`.

## Express

```js
import express from 'express';
import { createClient, createExpressMiddleware } from 'geckodupe';

const app = express();
app.use(express.json());
const gecko = createClient({ apiKey: process.env.GECKODUPE_API_KEY });

app.post('/submit', createExpressMiddleware(gecko), (req, res) => {
  res.json({ ok: true });
});
```

Duplicate or blocked payloads get a `409` (or configured status) before your handler runs.

## Fastify

```js
import Fastify from 'fastify';
import { createClient, createFastifyPlugin } from 'geckodupe';

const app = Fastify();
const gecko = createClient({ apiKey: process.env.GECKODUPE_API_KEY });
await app.register(createFastifyPlugin(gecko));
```

## Hono

```js
import { Hono } from 'hono';
import { createClient, createHonoMiddleware } from 'geckodupe';

const app = new Hono();
const gecko = createClient({ apiKey: process.env.GECKODUPE_API_KEY });
app.post('/submit', createHonoMiddleware(gecko), (c) => c.json({ ok: true }));
```

## React / Vue / Next

Call Geckodupe from **server routes, server actions, or your backend only**. Never ship `GECKODUPE_API_KEY` to the client.

## Electron

Keep the key in main / preload via env or secure storage. The renderer can use local `normalize` / `fingerprint` without the key.
