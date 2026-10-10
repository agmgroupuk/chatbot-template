# Personal subscriptions and visitor workspace

Implemented October 10, 2026 for One Fin sandbox `acct_1UOhth9TlJVLQeem`.

| Plan | USD recurring price | Card-backed trial |
| --- | ---: | ---: |
| Daily | 5 / day | 1 day |
| Weekly | 13 / week | 2 days |
| Monthly | 30 / month | 3 days |
| Yearly | 249 / year | 5 days |

Personal memberships and trials include unlimited responses. Business is a separate contact-sales option; team workspaces are not included yet. Legacy credit balances and subscriptions remain intact. New prices use `onefin_v2_*` lookup keys; IDs are recorded in `personal-plan-ids.json`.

## Payment flow

`/subscribe` uses Stripe Payment Element on One Fin's domain. A SetupIntent saves a card for off-session billing. The server checks authenticated customer ownership, successful setup, card type, and the selected server-approved price before creating a subscription. Consent and trial eligibility are persisted. There is one trial per account and card fingerprint across all plans. Only a keyed fingerprint hash is stored, never card numbers or CVC.

Enrollment request IDs and Stripe idempotency keys protect retries. Trial claims are committed before subscription creation so an ambiguous timeout cannot free the trial for another account. Retrying recovers the subscription through enrollment metadata. Requests unresolved after 23 hours require support review instead of risking a new charge after Stripe's idempotency window.

Subscriptions use automatic card collection and flexible billing. No hosted Checkout or Customer Portal is created. Card setup can require bank authentication. A zero-dollar trial invoice does not grant a paid term: verified card-backed trials grant only until trial expiry, and paid invoices extend access using the invoice line's own period end. Delayed older invoices cannot extend access into the latest unpaid period. Failed renewals do not extend access.

Plan changes use Subscription Schedules at the current period end, without proration. A trial change preserves the existing trial expiry and does not create another trial. Selecting the current plan removes a pending switch. Cancellation releases a managed pending schedule and stops renewal at period end. Payment-method updates and outstanding invoice recovery stay on-domain.

## Visitors and monthly login

`/workspace` and the homepage chat open without an account prompt. Visitors can send unlimited messages; conversations remain in the current page session and are not saved. Per-visitor request throttling remains enabled to protect the service from abuse. Account sessions expire absolutely after 30 days; activity does not extend them.

Counters use a signed HttpOnly cookie, keyed browser-characteristic hashes, and a keyed network identifier. Railway's overwritten `X-Real-IP` header is trusted; arbitrary `X-Forwarded-For` is not. IPv6 privacy addresses are grouped by /64. Raw addresses and raw browser profiles are not stored in these tables. Visitor records are removed after 32 days.

Visitor identifiers support abuse throttling only; they do not impose a daily message quota. They are not proof of a person's identity. Reliable cross-device identity requires authentication; there is no claim of unbreakable fingerprinting.

## Deployment and configuration

Migration `004_trials_workspace.sql` adds isolated billing enrollment, trial claims, membership access, notice outbox, and visitor counters. `npm start` starts Next.js and a minute-based maintenance loop. The loop retries One Fin SMTP notices and reconciles abandoned visitor reservations. It authenticates to an internal endpoint with `WORKSPACE_SIGNING_KEY`; do not expose or rotate that key casually.

Runtime prerequisites:

- `STRIPE_SECRET_KEY`: replacement sandbox secret, supplied through Railway secrets.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: matching sandbox publishable key.
- `STRIPE_EXPECTED_ACCOUNT_ID=acct_1UOhth9TlJVLQeem`, `STRIPE_MODE=test`.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the One Fin webhook.
- `WORKSPACE_SIGNING_KEY`: stable random 32+ character value.
- `OPENAI_API_KEY` or configured `XAI_API_KEY` for real responses.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` for account and billing email.

Optional Stripe receipt, trial, and recovery emails must be disabled in Stripe Dashboard before customer launch; One Fin uses its own outbox. Bank authentication messages are controlled by the bank. SMTP uses stable message IDs and retry leases; it is at-least-once delivery, not a guarantee against duplicate email after a delivery/commit failure.

The Stripe plugin provisioned the new prices and webhook. The workspace helper configured the expected account, webhook secret, and workspace key without printing secrets. At implementation time Stripe API/publishable keys, AI keys, and SMTP were absent from Railway. No real charge, inbox delivery, or real AI response is claimed while those prerequisites remain missing. Test mode remains enforced even in production.

## Verification and references

Verification: 24 backend tests (including the added 30-day session test) and 43 browser checks passed; production build, TypeScript and lint passed. External card charging, email delivery and AI generation remain unverified without runtime credentials.

Backend tests cover unlimited guest reservations and one-time failed-request refunds, card-first trial activation, ambiguous Stripe response recovery, repeated card rejection, unlimited-access expiry, scheduled changes, and invoice replay ordering. Browser tests cover pricing, trial entry, guest chat and provider failure/refund behavior, plus existing account functionality.

Planner guide: `iguide_61VY9k80xpO7gGMfI419TlJVLQeem`. Its generated Checkout/Accounts v2 example was not adopted because the merchant explicitly requires custom Elements and preserving existing Customer IDs.

- [Stripe SetupIntents](https://docs.stripe.com/api/setup_intents)
- [Stripe trials](https://docs.stripe.com/billing/subscriptions/trials/free-trials)
- [Subscription Schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules)
- [Railway trusted request headers](https://docs.railway.com/networking/public-networking/specs-and-limits)
