# Blocklists

Per-key (tenant) blocklists add custom phrases, domains, or tokens that should score as spam.

## GET /v1/spam/blocklist

```bash
curl -s https://geckodupe-spam.nic-58f.workers.dev/v1/spam/blocklist \
  -H "Authorization: Bearer $GECKODUPE_API_KEY"
```

```json
{ "blocklist": ["badphrase", "spam.example"] }
```

## PUT /v1/spam/blocklist

Replaces the full list for that API key tenant.

```bash
curl -s -X PUT https://geckodupe-spam.nic-58f.workers.dev/v1/spam/blocklist \
  -H "Authorization: Bearer $GECKODUPE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"blocklist":["badphrase","spam.example"]}'
```

```json
{ "ok": true, "count": 2 }
```

## SDK

```js
await gecko.putBlocklist(['badphrase', 'spam.example']);
const list = await gecko.getBlocklist();
```

## Limits

Blocklist size is capped server-side. Keep entries short and specific. Prefer domains and distinctive phrases over huge dictionaries.

You can also pass a one-off `options.blocklist` on score / clean / check without saving it.
