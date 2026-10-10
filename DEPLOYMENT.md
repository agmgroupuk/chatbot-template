# One Fin Solution deployment

The application runs on the existing Railway project `romantic-charm`, application service `chatbot-template`, and its existing PostgreSQL service. The canonical origin is https://onefinsolution.online. No Supabase project is required or used. The Sanbay Stripe account must never be used for this project.

## Infrastructure and migration

The previous integration used Supabase for PostgreSQL queries, Auth passwords and sessions, browser auth listeners, OAuth callbacks, RLS identity, profile triggers, and chat-message functions. All runtime SDK usage has been replaced with `pg`, server-side ownership checks, scoped PostgreSQL RLS, database-backed opaque sessions, and standard Next.js actions/routes. Supabase, Anthropic, and Update.dev packages are removed. Historical SQL files are retained only as source records; deployment applies only `migrations/railway/*.sql`.

`DATABASE_URL` points to the existing Railway private PostgreSQL service. No credentials are embedded in the repository. The database was inspected before migration: it contained no application tables or users. A full pre-migration dump was saved on its volume as `/var/lib/postgresql/data/onefin-before-native-migration.sql`. The native schema includes users, sessions, verification/reset tokens, auth rate limits, profiles, chats/messages, contexts, Stripe customer links, subscription snapshots, checkout attempts, credit buckets/allocations/usage, indexes, foreign keys, RLS and atomic credit functions.

`npm run db:migrate` checks migration checksums with normalized line endings, takes an advisory lock, and applies each new file transactionally. Railway runs it before deployment. The first migration refuses a populated legacy schema rather than overwriting it. No source Supabase credentials/project were supplied; no external historical records were accessible to import. Existing Railway data is preserved.

`.railway/railway.ts` manages only this application's partial and preserves the GitHub main branch and custom domain. Review `railway config plan` before apply. Add `preserve()` declarations for newly supplied provider variables before later IaC applies; undeclared variables are rejected by the CLI. On Windows, the SDK may require `_` to point to `%APPDATA%/npm/node_modules/@railway/cli/bin/railway.exe`, scoped to the command and restored afterwards.

## Authentication

Passwords use salted scrypt, minimum 12 and maximum 128 characters. Sessions use 256-bit random opaque tokens; only their SHA-256 hashes are stored. Production cookies use the `__Host-` prefix, HttpOnly, Secure, SameSite=Lax, and a seven-day lifetime. Every protected page and mutation checks the database session; middleware cookie checks are only routing hints. Server Actions enforce Next.js origin checks. Database rate limits cover account and IP attempts. Unknown-account responses avoid enumeration.

Signup requires email confirmation. Verification links last 24 hours; reset links last 30 minutes. Tokens are hashed, single use, and consumed transactionally. Password reset invalidates all sessions and other reset tokens. Missing SMTP blocks email-dependent operations with a clear error; the app never claims mail was sent when delivery was unavailable. SMTP acceptance does not prove inbox delivery; verify actual receipt with the configured provider. Google OAuth buttons were removed because no Google provider is configured; email callback and redirects are implemented.

User queries run with a scoped database role inside transactions, using `app.user_id` for RLS. Pool reuse cannot retain another user's identity. Server billing/auth operations remain private and use the database owner connection; no database credentials or billing RPCs are exposed to browsers.

## Required environment variables

See `.env.example`. Configure actual values in Railway or ignored `.env.local`, never source or Git:

- Existing infrastructure: `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `PORT` (Railway supplies it).
- Mail: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` with a verified sender.
- AI: `AI_PROVIDER=openai`, `OPENAI_MODEL=gpt-4.1-mini`, `OPENAI_API_KEY`; alternatively `AI_PROVIDER=xai`, `XAI_MODEL=grok-4.3`, `XAI_API_KEY`.
- Billing: `BILLING_PROVIDER=stripe`, `STRIPE_MODE=test`, `STRIPE_SECRET_KEY`, `STRIPE_EXPECTED_ACCOUNT_ID`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_CREDIT_PLANS`.
- Checkout domain and shared auth: `NEXT_PUBLIC_CHECKOUT_URL=https://pay.onefinsolution.online`, `SESSION_COOKIE_DOMAIN=.onefinsolution.online`.
- Workspace credits: `SIGNUP_CREDITS=10`, `WORKSPACE_CREDIT_COST=1`.

Opaque sessions require no JWT/signing secret. No Supabase, Update.dev, or Anthropic configuration is required. Never supply the Sanbay account's credentials.

## AI providers

OpenAI uses the official SDK's Responses API with `store:false`; xAI uses its compatible Chat Completions endpoint at `https://api.x.ai/v1`. Provider/model settings are server-only. Saved legacy model preferences resolve to the configured provider without changing historical chats. API timeouts, rate limits, unavailable credentials, empty responses, and provider failures return safe errors. Each successful response costs one credit; failures refund the reservation once. No valid AI key is currently available, so real inference is not yet verified.

## Stripe Test catalog

These initial USD test amounts are implementation defaults, not approved Live business prices:

| Product | Price | Access |
| --- | --- | --- |
| Homepage chat plans | Daily $5, Weekly $13, Monthly $30, Yearly $249 | Subscription access to homepage chat only; no Workspace credits |
| Workspace credit pack | $5 once | 50 Workspace credits; no chat subscription |

`node scripts/provision-stripe.mjs` verifies the intended account and Test Mode before any write. Its default is dry-run; `--apply` creates only app-marked/idempotent Workspace one-time Test products, prices and webhook. Homepage chat recurring prices are managed separately. IDs go to `billing/stripe-test-ids.json`; a new signing secret goes only to ignored `.env.stripe-generated`. Existing unmanaged/mismatched objects fail closed. `node scripts/configure-railway.mjs --apply` requires a Test secret, matching Test publishable key, and the account/webhook/credit mapping before it can change Railway variables. It transfers values through stdin and suppresses secrets.

The raw-body webhook `/api/stripe/webhook` verifies signatures, rejects Live events and grants only verified one-time Workspace credit-pack payments. Homepage chat subscriptions are processed separately and grant access only; they never create Workspace credit. Checkout reconciliation verifies the authenticated owner's Stripe customer and actual payment state. Stable references prevent duplicate credits. Subscription state is fetched from Stripe, not trusted from stale events. Plan changes take effect at renewal without proration. Cancellation preserves chat access through the paid period. Workspace packs and signup credits do not expire.

Workspace credit reservations serialize on the user row, reject overspending, and refund failed tasks exactly once. Abandoned reservations are reconciled after ten minutes. Browser roles cannot mint, spend, or refund directly.

## Verification

Commands: `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run db:migrate`, `npm start`.

Tests use actual PostgreSQL SQL through PGlite for native schema/RLS, atomic credits, auth confirmation/reset, expiry, hashing, session revocation, rate limits and concurrency. Stripe signature tests use real signature verification with mocked network fulfillment. Provider mocks do not establish real provider availability.

After credentials arrive, test actual email receipt; signup/signin/profile/logout/recovery; session persistence and guest protection; context CRUD and chat persistence; OpenAI/xAI successful and failed Workspace requests; paid/declined/cancelled Stripe Test credit-pack payments; duplicate/out-of-order webhooks; chat-subscription renewal/plan changes/cancellation; and separate Workspace credit fulfillment. Verify the checkout alias and cross-subdomain session on Railway. Inspect Railway runtime logs afterwards. A custom domain serving HTTP 200 alone does not prove these integrations work.

No repository-owned YAML files exist; deployment uses TypeScript IaC. No extra YAML tooling is needed.

## Later Live switch

1. Approve exact business prices/credits and complete real Test end-to-end verification first.
2. Use a separate Live environment/account data boundary; create corresponding Live products, prices and webhook. Never reuse Test IDs or customer/subscription records.
3. Configure that Live account identity/key, webhook signing secret and exact Live Price-to-credit mapping.
4. Set `STRIPE_MODE=live` only with explicit approval and matching Live keys, account ID, webhook secret, and Live Price mappings. Production NODE_ENV alone never implies Live Mode.
5. Rebuild/deploy; verify a controlled real charge, signature enforcement, allowance assignment, renewal, cancellation, failure handling and reconciliation before public launch.

Runtime dependencies audit clean. Seven high development-tool glob/lint findings remain; a forced incompatible downgrade is not used.

References: [OpenAI model and supported endpoints](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [xAI API](https://docs.x.ai/developers/rest-api-reference/inference/chat-completions), [Stripe webhooks](https://docs.stripe.com/webhooks), [Railway IaC](https://docs.railway.com/infrastructure-as-code).
