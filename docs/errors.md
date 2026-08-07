# Errors

## HTTP status

| Status | Meaning |
|--------|---------|
| 200 / 201 | Success |
| 400 | Bad input (validation) |
| 401 | Missing / invalid API key or session |
| 403 | Forbidden (unverified email, key limit) |
| 404 | Unknown route |
| 405 | Wrong method |
| 429 | Rate limit or daily API quota |
| 502 / 503 | Upstream (email, Stripe) or misconfiguration |
| 500 | Unexpected server error (JSON body when possible) |

## Body shape

```json
{
  "error": "Human readable message",
  "code": "quota"
}
```

`code` is optional. Quota responses may include `plan`, `used`, and `limit`.

## SDK errors

The SDK throws on non-OK responses (`GeckodupeApiError`) and on timeouts (`GeckodupeTimeoutError`). Catch and map to your HTTP status for clients.

## Common fixes

| Problem | Fix |
|---------|-----|
| 401 on API calls | Check `Bearer gd_live_…` key; recreate if revoked |
| 403 creating keys | Verify email on Account |
| 429 quota | Upgrade on Pricing or wait for UTC day roll |
| 429 rate limit | Back off; limiter is per tenant / IP |
| Checkout fails | Sign in first; use Basic, Starter, or Pro |
| Register ok but no mail | Use **Resend verification**; check spam |
| Resend returns 502 | Email provider issue — retry shortly |
| Portal unavailable | Complete Checkout once so Stripe has a customer |

## Health

```bash
GET /v1/health
```

Returns service version plus `emailConfigured`, `stripeConfigured`, and `openApi` (dev-only open access flag). No secrets are exposed.
