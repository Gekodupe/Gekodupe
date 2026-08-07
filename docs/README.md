# Geckodupe Docs

Geckodupe normalizes messy input so it becomes comparable, then deduplicates, despams, or rejects retries. Browser tools stay on-device. The hosted API is for your servers and backends.

## Base URL

```
https://geckodupe-spam.nic-58f.workers.dev
```

## Install

```bash
npm install geckodupe
```

Authenticate with a Geckodupe API key from the product. No infrastructure setup is required on your side.

## Start here

1. [Quick start](quickstart.md) - account, key, first call
2. [Get an API key](api-keys.md)
3. [SDK](sdk.md) or [Spam API](spam-api.md) / [Events API](events-api.md)
4. [Local browser tools](local-tools.md) - options and settings for Text, Directories, Media, Spam
5. [Plans](plans.md) · [Security](security.md)
6. Legal: Terms, Privacy, and Acceptable Use live in the app under **Legal** (`#legal`)

## Surfaces

| Surface | Where | Leaves the device? |
|---------|-------|--------------------|
| Text Data, Directories, Media, Spam | Browser | No |
| API keys and usage | API tab | Session and API traffic only |
| Hosted score / clean / check / events | API | Yes - called from your server |

## How it works

Raw lines and form payloads are noisy. Timestamps, IDs, query junk, and casing hide duplicates. Geckodupe normalizes first so retries, floods, and near-copies match. Then you score, clean, or block.
