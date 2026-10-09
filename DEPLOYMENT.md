# Deployment and verification

The app retains Next.js, Supabase Auth/Postgres, and Anthropic. Billing supports the original Update.dev adapter and a direct Stripe adapter. Railway uses the direct adapter (`BILLING_PROVIDER=stripe`) for the complete credit/payment path. No Update.dev account is required for that path. The separate Railway Postgres service is not a replacement for Supabase Auth.

## Required environment

Configure in Railway service `chatbot-template`, project `romantic-charm` (`3c67a3e5-8d96-462c-8ed1-9c2c64a4949f`). Local secrets belong in ignored `.env.local`. Never commit keys.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://onefinsolution.online` on Railway; localhost only for local development |
| `NEXT_PUBLIC_SUPABASE_URL` | Intended Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only credit ledger and billing fulfillment access |
| `ANTHROPIC_API_KEY` | Server-only AI access |
| `BILLING_PROVIDER` | `stripe` for direct billing; `update` retains the original adapter |
| `STRIPE_SECRET_KEY` | Intended account's `sk_test_` or `rk_test_` key only |
| `STRIPE_EXPECTED_ACCOUNT_ID` | Mandatory account identity check before Stripe operations |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/stripe/webhook` |
| `STRIPE_CREDIT_PLANS` | JSON mapping of actual Test Price IDs to credit counts and `subscription`/`pack` kinds |
| `SIGNUP_CREDITS` | Configured as `10`; granted once per authenticated account |
| `CHAT_CREDIT_COST` | Configured as `1` per successful AI response |
| `NEXT_PUBLIC_UPDATE_ENVIRONMENT` | `test`; Live Mode is rejected even on Railway production |
| `NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY` | Only needed if selecting the original Update.dev provider |
| `PORT` | `8080`, matching the existing domain target |

`SUPABASE_ACCESS_TOKEN` is optional local deployment tooling access for schema/auth configuration, never an application runtime requirement. A management token can also be used to provision a Supabase project and obtain its app keys. SMTP and Google OAuth credentials belong in the intended Supabase project.

All `NEXT_PUBLIC_*` values are bundled at build time: redeploy after changes. `/api/health` reports process availability. It does not prove external integrations work. If Supabase is absent, application routes return a deliberate 503 instead of fabricated authentication or placeholder data.

## Supabase setup

For a new project run `setup_db.sql`, then migrations `001_security.sql` and `002_billing_credits.sql`. For an existing app database apply only the unapplied migrations. Existing users, IDs, profiles, messages, and contexts are preserved. The security migration repairs missing historical profiles.

With a management token and the intended URL available, `node scripts/migrate-supabase.mjs` previews the target and `--apply` applies the required migrations. It refuses an unrelated database without the Supabase auth schema, tracks migrations, and commits each schema change and its history record together.

Set Auth Site URL to `https://onefinsolution.online`. Allow that domain's `/auth/callback` and `/auth/callback?next=/reset-password`, plus localhost equivalents for development. Configure SMTP for actual signup, resend, and reset delivery. PKCE recovery links must be opened in the browser that requested recovery. Enable Google and configure its provider credentials only if Google sign in will be offered.

## Initial USD Test catalog

The nonsecret source of truth is `billing/test-catalog.json`. These are initial Test Mode defaults, not approved Live pricing.

| Product | Price | Credits | Expiry |
| --- | --- | --- | --- |
| Basic monthly | $9/month | 100 per paid invoice | Paid billing period end |
| Basic annual | $90/year | 1200 per paid invoice | Paid billing period end |
| Pro monthly | $19/month | 300 per paid invoice | Paid billing period end |
| Pro annual | $190/year | 3600 per paid invoice | Paid billing period end |
| 50 Credit Pack | $5 once | 50 | No expiry |

Annual credits are allocated once for the annual invoice, rather than refilled each month. Signup credits do not expire. Existing grants remain unchanged if signup allowance configuration later changes.

`node scripts/provision-stripe.mjs` verifies the Test key and expected account and previews the catalog. `--apply` creates only this app's marked Test products, prices, and webhook. Reruns verify exact names, descriptions, amounts, currency, intervals, and credits. Conflicting objects fail closed. Unrelated Stripe objects are untouched.

The script records real IDs in `billing/stripe-test-ids.json`; this file contains no keys. A newly generated webhook secret is stored only in ignored `.env.stripe-generated` and is never printed. If an existing endpoint's signing secret is needed, obtain it through the authorized Stripe account.

`node scripts/configure-railway.mjs` validates the linked project and required inputs. `--apply` transfers whitelisted variables through stdin with values suppressed. It can read the generated catalog and signing secret. No real products or Price IDs can be generated until the intended Stripe account is accessible. The locally logged-in CLI Sandbox is named for Sanbay Fusion; do not use it without confirmation that it is intended for this app.

## Payments and credits

`/api/stripe/webhook` verifies the raw request signature and rejects Live events. Its events are `invoice.paid`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and subscription created/updated/deleted. Failed/unpaid payments grant nothing. Subscription allowances come only from paid invoice lines. One-time credits come only from paid checkout line items. Stable grant references prevent duplicate delivery from granting twice.

The checkout return is also reconciled against the authenticated user's stored Stripe customer and the actual Stripe payment state; a URL query alone cannot grant credits. This makes delayed webhook delivery recoverable. Every Stripe operation validates the configured account and Test Mode. Customer identity is linked by authenticated user ID, never email alone.

The database serializes checkout attempts per user. Retries reuse the same Stripe idempotency key and session; changing a pending selection expires the previous session. An existing recurring subscription blocks another recurring purchase. Credit packs remain available to subscribers.

Upgrades and downgrades are scheduled for the next renewal with no prorated credit grant. The current paid allowance keeps its original expiry, and the next paid invoice allocates the new plan's allowance. Cancellation releases an app-owned pending schedule before scheduling cancellation at period end. Immediate subscription cancellation expires its subscription buckets; purchased packs remain intact. Subscription records are synchronized from Stripe's current state, not a stale webhook snapshot.

Before an AI call, the server reserves credits atomically. Spending uses the earliest-expiring available buckets first and never consumes expired balances. Successful responses finalize the reservation; failed/empty AI calls refund it once. Requests abandoned by a crashed worker are refunded after ten minutes, on the next balance read or reservation. AI requests have a one-minute per-attempt timeout and at most one retry. Browser roles cannot grant, reserve, or refund credits. Profile/account pages display the database balance.

## Railway configuration

`.railway/railway.ts` manages only the chatbot service partial, with its existing GitHub main branch and custom domain. It sets build/start/healthcheck configuration and preserves existing environment values without embedding secrets. The old deprecated `railway.json` was removed. Update preserved variable declarations before applying IaC after adding new variables; the CLI fails closed on undeclared variables.

On Windows, the current Railway SDK needs its real executable for the CLI version check. If needed, set the command's `_` environment variable to `%APPDATA%/npm/node_modules/@railway/cli/bin/railway.exe` for `railway config plan/apply`, restoring it afterwards. Review a plan before applying. Do not take ownership of the separate Postgres resource.

## Verification

Run `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm start`. Tests exercise the actual SQL using a local PostgreSQL engine, including full schema migration, identity preservation, RLS, credit expiry, duplicate grants, refunds, crash recovery, concurrent spending, and webhook signature/fulfillment rules. These local tests do not replace real provider end-to-end tests.

After credentials are supplied, verify the deployed domain on desktop/tablet/mobile: signup and confirmation delivery, sign in, profile editing, context CRUD, chat creation/reload and credit deduction, recovery/reset, logout, protected routes, and Google callback when configured. Complete Stripe Test checkout, cancelled and declined payments, async success/failure, duplicate webhooks, re-login, scheduled plan changes, cancellation/reactivation, and credit expiry. Read Railway runtime logs after testing.

## Later Live switch

Only after explicit approval and successful end-to-end Test verification:

1. Review and approve the catalog amounts and credit policy. Keep the Test account/database records isolated.
2. Create corresponding products, prices, and webhook in the intended Live Stripe account. Never reuse Test Product, Price, Customer, or Subscription IDs.
3. Set Live account identity, key, signing secret, and exact Live Price-to-credit mapping in a separate environment.
4. Explicitly update and review the Test-only guards in `lib/stripe.ts`, `lib/billing-environment.ts`, webhook Live rejection, checkout session validation, and tooling. `NODE_ENV=production` must never select Live Mode implicitly.
5. Rebuild/redeploy with the approved Live configuration. Verify a controlled real transaction, signature enforcement, allowance assignment, renewal, plan change, cancellation, failure handling, and reconciliation before general launch.

No Live Stripe credentials or objects were used or changed.

## Dependency review and references

The runtime audit is clean. Seven high development-tool glob/lint dependency findings remain, including an advisory with no compatible fix; forcing the proposed dependency downgrade is not a safe resolution.

References: [Stripe webhooks](https://docs.stripe.com/webhooks), [Supabase Management API](https://supabase.com/docs/reference/api/introduction), [Anthropic model lifecycle](https://platform.claude.com/docs/en/about-claude/model-deprecations), and [Railway infrastructure configuration](https://docs.railway.com/infrastructure-as-code).
