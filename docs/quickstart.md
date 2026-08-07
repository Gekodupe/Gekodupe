# Quick start

## 1. Create an account

Open the **Account** tab on [Geckodupe](https://gekodupe.github.io/Gekodupe/#account).

- Create an account with email and password, or use a magic link code
- Verify your email (required before creating keys)
- Optional: upgrade on **Pricing** for higher API limits

## 2. Create an API key

Open the **API** tab.

1. Create a key and copy it once
2. Store it as an environment variable on your server

```bash
export GECKODUPE_API_KEY=gd_live_...
```

Never put the key in a browser bundle, mobile app binary, or public repo.

## 3. Call from Node

```bash
npm install geckodupe
```

```js
import { createClient } from 'geckodupe';

const gecko = createClient({
  apiKey: process.env.GECKODUPE_API_KEY
});

const result = await gecko.checkEvent({
  fields: {
    email: 'user@example.com',
    message: 'Hello'
  },
  eventId: 'idempotency-key-from-client'
});

if (result.duplicate || result.decision === 'block') {
  // reject
}
```

## 4. Or call HTTP directly

```bash
curl -s https://geckodupe-spam.nic-58f.workers.dev/v1/health
```

```bash
curl -s -X POST https://geckodupe-spam.nic-58f.workers.dev/v1/spam/score \
  -H "Authorization: Bearer $GECKODUPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fields":{"email":"a@b.com","website":"http://spam.example"},"options":{"mode":"form"}}'
```

## Next

- [SDK](sdk.md) for Express, Fastify, Hono, Bun, Workers
- [Events API](events-api.md) for retries and webhooks
- [Plans and limits](plans.md) for quotas
