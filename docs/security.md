# Security

## Trust model

| Surface | Data handling |
|---------|---------------|
| Text Data, Directories, Media, Spam tabs | Processed in your browser. Datasets are not uploaded to Geckodupe for dedupe/despam |
| Account / Pricing | Email, auth, plan, and Stripe customer ids via HTTPS to the Geckodupe API |
| Hosted API (`/v1/spam/*`, `/v1/events/*`) | Your server sends payloads you choose; scored/cleaned server-side with your API key |

## API keys

- Format: `gd_live_<hex>`
- Send as `Authorization: Bearer …`
- **Server-side only** — never ship keys in browsers, mobile binaries, or public repos
- Shown once at creation; afterward only a prefix is stored in the UI
- Rotate: create a new key → update apps → revoke the old key
- Treat a leaked key as compromised immediately and revoke it

## Passwords and sessions

- Passwords hashed with PBKDF2-SHA-256 (100,000 iterations — Cloudflare Workers maximum)
- Salt stored per account; raw passwords are never stored
- Sessions are opaque `sess_…` tokens in KV with TTL (shorter without Remember me, longer with it)
- Magic codes and reset/verify tokens expire (minutes to hours depending on flow)

## What we store

| Data | Notes |
|------|-------|
| Account email, password salt/hash, plan, verification flag | Account record |
| Session tokens | KV with TTL |
| API key hashes (not raw secrets after mint) | KV; prefix shown in UI |
| Short burst / event fingerprints | KV with TTL |
| Daily usage counters | KV with TTL |
| Stripe customer / subscription ids | Account + Stripe |
| Static ops keys (optional `API_KEYS` secret) | Worker secret; not for end customers |

## Email

Transactional mail covers sign-in codes, email verification, and password reset. Delivery depends on the configured email provider. If mail fails, Account surfaces an error on register/resend when possible — check spam and use **Resend verification**.

## Payments

Card data is handled by Stripe Checkout and the Customer Portal. Geckodupe never sees full card numbers. Webhooks update plan status after Checkout and subscription changes.

## Transport and CORS

- API is HTTPS only
- Browser calls from the official app origin are allowed via CORS
- Custom domains must be listed in deployment config (`APP_ORIGIN` / allowlist)

## Rate limits and quotas

- Per-IP / per-tenant request rate limiting on auth and API routes
- Per-account daily API request quotas by plan (shared across keys)
- Soft local quotas on browser tools (guest vs signed-in)

## Operational safeguards

- Missing or invalid API keys → `401`
- Unverified email → cannot mint keys (`403`)
- Open anonymous API access is disabled unless explicitly enabled for development
- Worker errors return JSON error bodies (not opaque HTML) when the isolate can respond

## Report issues

See [`.well-known/security.txt`](../.well-known/security.txt) on the site for contact details. Include steps to reproduce, time (UTC), and whether the issue is auth, billing, or API.
