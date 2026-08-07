# geckodupe

Local-first **data normalization** and spam / idempotency engine.

The biggest value isn’t removing duplicates. It’s that everything first becomes comparable.

```bash
npm install geckodupe
```

You only need a **Geckodupe API key**. You do not need Cloudflare, Workers, or KV of your own - hosted burst memory and event dedupe run on Geckodupe’s API.

```
https://geckodupe-spam.nic-58f.workers.dev
```

## What it solves

| Problem | How |
|---------|-----|
| Double-click Submit | `checkEvent` / middleware → 409 on duplicate fingerprint |
| Browser / flaky network retries | Same normalized fingerprint within the burst window |
| Identical webhook deliveries | Pass `eventId` (delivery id) or `Idempotency-Key` |
| Confirmation page refresh storms | Event / fingerprint memory per API key tenant |
| Bots resubmitting the same payload | Normalize → fingerprint → score / block |
| Spam floods in forms and lists | Local or hosted `score` / `clean` |

## Quick start (hosted)

```ts
import { createClient } from 'geckodupe';

const gecko = createClient({ apiKey: process.env.GECKODUPE_API_KEY! });

const result = await gecko.checkEvent({
  fields: req.body,
  eventId: req.headers['idempotency-key']
});

if (result.duplicate || result.decision === 'block') {
  // reject - already seen or spam
}
```

## Local (no network)

Normalization and scoring run offline - useful in tests, Electron main, and edge cases before calling the API.

```ts
import { normalize, fingerprint, scorePayload, cleanText } from 'geckodupe';

const norm = normalize(rawText);
const fp = fingerprint(formFields, { mode: 'form' });
const score = scorePayload(formFields, { mode: 'form' });
const cleaned = cleanText(logDump, { mode: 'list' });
```

## Framework helpers

```ts
import { createClient, createExpressMiddleware } from 'geckodupe';
// also: createFastifyPlugin, createHonoMiddleware, idempotencyGuard

const gecko = createClient({ apiKey: process.env.GECKODUPE_API_KEY! });
app.post('/submit', createExpressMiddleware(gecko), handler);
```

See [`examples/`](./examples/) for Express, Fastify, Hono, Bun, Cloudflare Workers, and plain Node.

## React / Vue / Electron

- **React / Vue:** call Geckodupe from **server routes, server actions, or your backend** only. Never put `GECKODUPE_API_KEY` in a browser bundle.
- **Electron:** keep the key in the main/preload process via env or secure storage; use local `normalize` / `fingerprint` in the renderer if needed without the key.

## API surface

| Method | Path | Purpose |
|--------|------|---------|
| `client.score` | `POST /v1/spam/score` | Score a payload |
| `client.clean` | `POST /v1/spam/clean` | Despam text |
| `client.check` | `POST /v1/spam/check` | Score + burst memory |
| `client.checkEvent` | `POST /v1/events/check` | Idempotency / retries / webhooks |
| `client.getBlocklist` / `putBlocklist` | `/v1/spam/blocklist` | Per-key blocklist |

Auth: `Authorization: Bearer <GECKODUPE_API_KEY>`.

## Anti-patterns

- Shipping the API key to the browser or a public repo
- Expecting customers to create their own Cloudflare Worker for Geckodupe
- Skipping normalization and comparing raw timestamps / UUIDs / query noise

## Browser app

The visual tool (text, folders, media, despam) stays local-first in the browser: [Geckodupe](https://gekodupe.github.io/Gekodupe/). Package `@flareform/geckodupe` is the static app; **`geckodupe`** is this developer SDK.
