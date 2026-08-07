# Security

## API keys

- Use server-side only
- Rotate by creating a new key, updating your apps, then revoking the old one
- Treat a leaked `gd_live_` key as compromised immediately

## What we store

| Data | Notes |
|------|-------|
| Account email, password hash (PBKDF2), plan | Account store |
| Session tokens | Short-lived |
| API key hashes (not raw secrets after mint) | Account store |
| Short burst / event fingerprints | TTL |
| Daily usage counters | TTL |
| Billing customer / subscription ids | Stripe + account store |

Browser tool tabs (Text, Directories, Media, Spam) process files locally. They do not upload your datasets to Geckodupe for dedupe.

## Email

Transactional mail covers sign-in codes, verification, and password reset.

## Payments

Card data is handled by Stripe Checkout and the Customer Portal. Geckodupe never sees full card numbers.

## Report issues

See `.well-known/security.txt` on the site for contact details.
