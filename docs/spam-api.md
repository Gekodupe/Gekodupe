# Spam API

Base: `https://geckodupe-spam.nic-58f.workers.dev`

Auth: `Authorization: Bearer <API_KEY>`

Body size soft cap: about 256 KB JSON.

## POST /v1/spam/score

Score a payload without writing burst memory.

```json
{
  "fields": {
    "name": "Ada",
    "email": "ada@example.com",
    "website": ""
  },
  "options": {
    "mode": "form"
  }
}
```

Or:

```json
{ "text": "line one\nline two", "options": { "mode": "list" } }
```

### Options

| Field | Meaning |
|-------|---------|
| `mode` | `form`, `list`, or `log` |
| `blocklist` | Extra phrases / domains to reject |
| `burstWindowMs` | Used more by check endpoints |

### Response (shape)

```json
{
  "score": 0.82,
  "decision": "block",
  "reasons": ["honeypot", "disposable_email"],
  "fingerprint": "...",
  "normalized": "...",
  "mode": "form"
}
```

`decision` is typically `allow`, `soft_reject`, or `block`.

## POST /v1/spam/clean

Despam text or a list dump. Returns cleaned text plus score metadata.

```json
{
  "text": "keep me\nbuy cheap pills http://x.y\nkeep me too",
  "options": { "mode": "list" }
}
```

## POST /v1/spam/check

Score plus short-window burst / near-duplicate memory for the API key tenant.

```json
{
  "fields": { "email": "a@b.com", "message": "Hi" },
  "options": { "mode": "form", "burstWindowMs": 120000 },
  "remember": true
}
```

Optional Turnstile: pass `turnstileToken` when you enable Turnstile on your form and configure the Worker secret.

## Modes

| Mode | Best for |
|------|----------|
| `form` | Contact forms, signup fields, JSON form bodies |
| `list` | One entry per line, mailing lists, dumps |
| `log` | Log lines with noise (timestamps, IDs) |

## What gets caught

Examples of signals (not exhaustive):

- Honeypot fields
- URL floods
- Disposable mail domains
- Bait / spam phrases
- Near-duplicate bursts
- Gibberish / tracker junk (depending on options)

Tune with `options` and a [blocklist](blocklists.md).
