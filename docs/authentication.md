# Authentication

## API keys (server)

All hosted spam and event routes require:

```
Authorization: Bearer <GECKODUPE_API_KEY>
```

Example:

```bash
curl -X POST https://geckodupe-spam.nic-58f.workers.dev/v1/events/check \
  -H "Authorization: Bearer $GECKODUPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"hello","eventId":"evt_1"}'
```

Missing or invalid keys return `401`.

## Account sessions (browser)

The Account and API tabs use a session token after sign-in:

```
Authorization: Bearer sess_...
```

Sessions power:

- Account profile and plan
- Key create / revoke
- Stripe checkout and billing portal
- Usage history

You do not use `sess_` tokens in your application servers. Use `gd_live_` keys only.

## Sign-in methods

| Method | How |
|--------|-----|
| Password | Register / sign in on Account |
| Magic link | Email code or link (`#account?auth=...`) |
| Remember me | Longer session on this device |
| Forgot password | Reset link to `#account?reset=...` |
| Verify email | Link to `#account?verify=...` |

## Health (no auth)

```bash
GET /v1/health
```

Returns service name, version, and UTC time.
