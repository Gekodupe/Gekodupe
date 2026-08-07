# Events API

Use this for double submits, flaky retries, webhook redeliveries, and confirmation-page refresh storms.

## POST /v1/events/check

```json
{
  "fields": { "email": "a@b.com", "orderId": "1001" },
  "eventId": "idempotency-or-delivery-id",
  "options": { "mode": "form", "burstWindowMs": 120000 },
  "remember": true
}
```

You can also send `text` or `payload` instead of `fields`.

### eventId

Optional but recommended.

- Payment / form idempotency keys
- Webhook delivery IDs
- Client-generated UUIDs for a single user action

If the same `eventId` is seen again within the window for your tenant, `duplicate` is true.

### Response

```json
{
  "duplicate": true,
  "decision": "soft_reject",
  "fingerprint": "...",
  "score": 0.1,
  "reasons": ["duplicate_event"],
  "normalized": "...",
  "mode": "form",
  "eventId": "idempotency-or-delivery-id"
}
```

Treat `duplicate === true` or `decision === 'block'` as reject.

## SDK

```js
const result = await gecko.checkEvent({
  fields: req.body,
  eventId: req.headers['idempotency-key'] || req.body.eventId
});
```

## Middleware

Express / Fastify / Hono helpers call `checkEvent` (or equivalent) and short-circuit duplicates before your handler. See [SDK](sdk.md).

## remember

Set `"remember": false` to score without storing fingerprint / event memory (dry run). Default is remember on.
