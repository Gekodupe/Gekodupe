# Account and billing

Use the **Account** tab in the app for identity, verification, and billing. Use **Pricing** to compare plans and start Checkout. Use **API** for keys after email is verified.

## Create an account

1. Open **Account**
2. Enter email and password (at least 10 characters, letters and a number)
3. Click **Create account**
4. Check email for a verification link (also required before minting API keys)
5. Optional: enable **Remember me** for a longer session on this device

You can also **Email me a code** (magic link / one-time code) with no password.

## Sign in

- **Password** — email + password
- **Email code** — request a code, enter it on Account, or open the link in the email
- **Forgot password** — we email a reset link (`#account?reset=…`)

Sessions use a `sess_…` bearer token stored in the browser. Your servers should never use session tokens — use `gd_live_…` API keys only.

## After sign-in

The profile panel shows:

- Email
- Plan name (Basic, Starter, Pro) and status
- API usage today and key count
- **Manage billing** — Stripe Customer Portal
- **Pricing** — plan comparison / upgrade
- **API keys** — jump to the API tab
- **Sign out**

If email is not verified, a **Verify email** panel offers **Resend verification email**.

## Email verification

Verification unlocks API key creation. Links look like `#account?verify=…`. Resend from Account when signed in. Check spam/junk if nothing arrives.

## Plans and Checkout

| Plan | Role |
|------|------|
| Guest | Soft local caps, no API keys |
| Basic | Paid starter API allowance and higher local limits |
| Starter | Higher API volume |
| Pro | Production volume |

Flow:

1. Sign in on Account
2. Open **Pricing**
3. Choose a plan → Stripe Checkout
4. Return to `#pricing?checkout=success` (or cancel)

Canceled paid plans fall back to Basic limits after Stripe confirms via webhook.

## Customer portal

**Manage billing** (Account or Pricing when signed in) opens Stripe to:

- Update payment method
- Download invoices
- Cancel or change subscription

Return URL lands on Account.

## Session auth routes (web app only)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/auth/register` | Create password account |
| POST | `/v1/auth/login` | Password sign-in |
| POST | `/v1/auth/start` | Magic link / code |
| POST | `/v1/auth/verify` | Complete magic sign-in |
| POST | `/v1/auth/forgot` | Password reset email |
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

Product backends should call `/v1/spam/*` and `/v1/events/*` with API keys only.

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| Cannot create keys | Verify email; check plan key limit |
| No verification mail | Resend; check spam; wait and retry |
| Checkout fails | Sign in first; confirm plan is Basic/Starter/Pro |
| Portal unavailable | Sign in; complete at least one Checkout so Stripe has a customer |
| Session expired | Sign in again |
