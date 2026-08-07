# Plans and limits

## Hosted API

| Plan | Price / mo | API / day | Max keys |
|------|------------|-----------|----------|
| Free | $0 | 500 | 2 |
| Starter | $19 | 25,000 | 5 |
| Pro | $49 | 200,000 | 10 |
| Business | $149 | 1,000,000 | 25 |

When the daily API quota is hit, endpoints return `429` with a clear error. Upgrade on **Pricing** or wait until UTC midnight for the day bucket to roll.

Quota is per account, shared across keys.

## Local browser tools (guest vs signed in)

Guests can try Text Data, Directories, Media, and Spam with soft caps. Sign in on **Account** for higher local limits. Exact caps show on each tool banner.

Examples (guest):

- Text: about 2,000 lines, 5 runs / day
- Directories: about 40 files
- Media: about 25 files
- Spam: about 1,000 lines, 5 runs / day

## Billing

- Checkout and invoices run through Stripe
- **Manage billing** on Account (or Pricing) opens the Stripe Customer Portal
- Change payment method, download invoices, or cancel there
- Subscriptions renew monthly until canceled

## Public plans endpoint

```bash
GET /v1/billing/plans
```

No auth required. Returns plan copy, limits, and Stripe price IDs when configured.
