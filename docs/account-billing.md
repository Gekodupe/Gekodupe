# Account and billing

## Account tab

- Register / sign in (password or magic link)
- Remember me
- Forgot / reset password
- Email verification and resend
- Plan status and usage summary
- **Manage billing** (Stripe portal)
- Sign out

## Pricing tab

- Compare Free, Starter, and Pro
- Start Checkout (must be signed in)
- Open Stripe portal when signed in

## What the portal can do

- Update payment method
- View / download invoices
- Cancel subscription
- Return to Geckodupe Account when done

Canceled paid plans fall back to Free limits after Stripe confirms the change (webhook).

## Related API routes (session auth)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/auth/register` | Create password account |
| POST | `/v1/auth/login` | Password sign-in |
| POST | `/v1/auth/start` | Magic link / code |
| POST | `/v1/auth/verify` | Complete magic sign-in |
| POST | `/v1/auth/forgot` | Reset email |
| POST | `/v1/auth/reset` | Set new password |
| POST | `/v1/auth/verify-email` | Confirm email |
| POST | `/v1/auth/resend-verify` | Resend confirm mail |
| GET | `/v1/auth/me` | Session profile |
| POST | `/v1/auth/logout` | End session |
| GET | `/v1/account` | Profile, keys meta, usage |
| POST | `/v1/account/keys` | Create key |
| DELETE | `/v1/account/keys/:id` | Revoke key |
| GET | `/v1/billing/plans` | Public plan list |
| POST | `/v1/billing/checkout` | Stripe Checkout session |
| POST | `/v1/billing/portal` | Stripe portal session |
| GET | `/v1/billing/usage` | Usage + 7-day history |

These session routes are for the Geckodupe web app. Your product servers should use API keys only.
