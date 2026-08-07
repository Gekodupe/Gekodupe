# Geckodupe Docs

Geckodupe normalizes data so it becomes comparable, then dedupes, despams, or rejects retries. The browser tools stay local. The hosted API is for your servers.

**Base URL**

```
https://geckodupe-spam.nic-58f.workers.dev
```

**Install**

```bash
npm install geckodupe
```

You only need a Geckodupe API key. You do not deploy Cloudflare yourself.

## What to read first

1. [Quick start](quickstart.md)
2. [Get an API key](api-keys.md)
3. [SDK (npm)](sdk.md) or [Spam API](spam-api.md) for raw HTTP

## Product map

| Surface | Where | Data leaves device? |
|---------|-------|---------------------|
| Text Data, Directories, Media, Spam tabs | Browser | No |
| API keys and usage | API tab | Session + API only |
| Account and billing | Account tab | Auth + Stripe |
| Hosted score / clean / check / events | Worker API | Yes, your server calls |

## Core idea

Raw lines and form payloads are noisy. Timestamps, UUIDs, query junk, and casing hide duplicates. Geckodupe normalizes first so retries, floods, and near-copies match. Then you score, clean, or block.
