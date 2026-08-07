# Errors

## HTTP status

| Status | Meaning |
|--------|---------|
| 200 / 201 | Success |
| 400 | Bad input (validation) |
| 401 | Missing / invalid API key or session |
| 403 | Forbidden (unverified email, key limit, Turnstile) |
| 404 | Unknown route |
| 405 | Wrong method |
| 429 | Rate limit or daily API quota |
| 502 / 503 | Upstream (email, Stripe) or misconfiguration |

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
| 401 on API calls | Check `Bearer` key, revoke/recreate if leaked |
| 403 creating keys | Verify email on Account |
| 429 quota | Upgrade plan or reduce traffic |
| 429 rate limit | Back off; default limiter is per tenant / IP |
| Checkout fails | Sign in first; confirm Stripe prices are configured |
| No mail | Check spam folder; sender is nic@blacnova.net |
