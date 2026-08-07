# Geckodupe API (hosted Worker)

Hosted spam prevention and event idempotency API. Customers never deploy Cloudflare themselves — they use a **Geckodupe API key** with the [`geckodupe`](../sdk/) npm package (or raw HTTP).

The browser Spam tab stays local-only. This Worker is the product API for server-side integrations.

## Live base URL

```
https://geckodupe-spam.nic-58f.workers.dev
```

## Auth & accounts

```bash
npx wrangler secret put API_KEYS          # optional static keys
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put BREVO_SENDER_EMAIL
npx wrangler secret put BREVO_SENDER_NAME
npx wrangler secret put APP_ORIGIN        # e.g. https://gekodupe.github.io/Gekodupe
```

| Method | Path | Notes |
|--------|------|-------|
| POST | `/v1/auth/start` | Email magic code via Brevo |
| POST | `/v1/auth/verify` | Exchange code/token for session |
| POST | `/v1/auth/logout` | End session |
| GET | `/v1/auth/me` | Session email |
| GET | `/v1/account` | Profile + keys |
| POST/GET/DELETE | `/v1/account/keys` | Create / list / revoke API keys |

Issued keys (`gd_live_…`) work on `/v1/spam/*` and `/v1/events/*` the same as static `API_KEYS`.

When `API_KEYS` is set, all `/v1/spam/*` and `/v1/events/*` routes require:

```
Authorization: Bearer <geckodupe_api_key>
```

`/v1/health` stays open. Account routes use `Authorization: Bearer sess_…`.

Tenant KV namespaces are derived from a hash of the API key (raw keys are never stored in KV paths).

Bodies are capped at 256KB. `eventId` max length 128. Blocklists max 500 phrases.

## Routes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/v1/health` | Liveness |
| POST | `/v1/spam/score` | Score payload |
| POST | `/v1/spam/check` | Score + KV burst memory (+ optional Turnstile) |
| POST | `/v1/spam/clean` | Despam text body |
| GET/PUT | `/v1/spam/blocklist` | Per-tenant blocklist |
| POST | `/v1/events/check` | Idempotency: double-submit, retries, webhooks, refresh storms |

## Commands

```bash
npm install --legacy-peer-deps
npx wrangler dev
npx wrangler deploy
npm test
```

## SDK

```bash
npm install geckodupe
```

See [`../sdk/README.md`](../sdk/README.md).
