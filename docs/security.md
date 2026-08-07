# Security

## API keys

- Server-side only
- Rotate by creating a new key, updating deploys, then revoking the old one
- Treat a leaked `gd_live_` key as compromised immediately

## What we store

| Data | Where |
|------|-------|
| Account email, password hash (PBKDF2), plan | Worker KV |
| Session tokens | Worker KV with TTL |
| API key hashes (not raw secrets after mint) | Worker KV |
| Short burst / event fingerprints | Worker KV with TTL |
| Daily usage counters | Worker KV with TTL |
| Billing customer / subscription ids | Worker KV + Stripe |

Browser tool tabs (Text, Directories, Media, Spam) process files in your browser. They do not upload your datasets to Geckodupe for dedupe.

## Email

Transactional mail (sign-in codes, verify, reset) is sent through Brevo from Blacnova Development.

## Payments

Card data is handled by Stripe Checkout and the Customer Portal. Geckodupe never sees full card numbers.

## Report issues

See `.well-known/security.txt` on the site for contact details.
