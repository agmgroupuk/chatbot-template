# Deployment and verification

This application uses Next.js, Supabase Auth/Postgres, Update.dev billing backed by Stripe, and Anthropic. Railway's separate Postgres service does not replace Supabase Auth and is not used by the application.

## Required environment

Configure in Railway service `chatbot-template`, project `romantic-charm`. For local development copy `.env.example` to the ignored `.env.local` and fill the values. Never commit keys.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://onefinsolution.online` on Railway; `http://localhost:3000` locally |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key; never use service-role key here |
| `NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY` | Publishable key from the intended Update.dev project |
| `NEXT_PUBLIC_UPDATE_ENVIRONMENT` | `test`; this release rejects `live` |
| `ANTHROPIC_API_KEY` | Server-only Anthropic key |
| `PORT` | Railway target port; configured as `8080` to match the existing domain |

All `NEXT_PUBLIC_*` settings are bundled at build time: redeploy after changes. The app deliberately does not require secrets to compile. `/api/health` checks process availability; other routes return 503 when Supabase configuration is absent. A healthy deployment alone does not prove external integrations work.

## Supabase

1. Confirm the intended project before running SQL. For a new project run `setup_db.sql` once. For an existing installation apply `migrations/001_security.sql`, which preserves records and repairs missing profiles. Do not rerun the entire setup script on an existing database.
2. Set Auth Site URL to `https://onefinsolution.online`. Allow `https://onefinsolution.online/auth/callback`, `https://onefinsolution.online/auth/callback?next=/reset-password`, and equivalent localhost callbacks for development.
3. Configure SMTP and test signup confirmation, resend, and recovery delivery. Password recovery uses PKCE: open the emailed link in the browser that requested it.
4. If Google login is desired, enable Google's provider and configure its credentials in Supabase, with the Supabase callback URL in Google Cloud.
5. Test RLS with two users: neither may access the other's profile, chats, messages, context, or message RPC.

## Billing: Test Mode only

The existing SDK fetches product and price IDs from Update.dev rather than embedding them in source. Stripe keys and webhook secrets belong in the connected provider configuration; this app currently has no direct Stripe SDK or Stripe webhook endpoint. Do not send Stripe webhooks to an invented application route.

Connect the correct Stripe Sandbox/Test account in Update.dev. Configure USD products/prices and entitlements there, then verify they appear in `/pricing`. Exact plan amounts, intervals, signup credits, credit packs, and usage costs require the owner's specification. No prices or credit allowances have been invented. The locally authenticated Stripe CLI account belongs to a different restaurant project and must not be used for this catalog without explicit account confirmation.

The checkout action authenticates the user, validates the price against the provider catalog, and refuses a second recurring checkout while an active or past-due subscription exists. Cancellation/reactivation checks subscription ownership. The provider is responsible for payment confirmation and subscription synchronization; the checkout return query is not proof of payment. Upgrades/downgrades and credit accounting are not yet implemented or verified. The installed Update.dev SDK exposes billing and entitlements, but no credit consumption API.

## Validation

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, then `npm start`. Railway uses `railway.json`, binds on `0.0.0.0`, and healthchecks `/api/health`.

After credentials and schema are configured, test desktop, tablet, and mobile: signup/email, login, profile edit, context CRUD, chat creation/reload, recovery/reset, logout/protected routes, and Google callback if enabled. Test Stripe success, cancel, declined payment, duplicate checkout, cancellation/reactivation, webhook retry, and subscription refresh after re-login. Verify credits atomically and against Stripe once their design is specified and implemented.

Railway currently supports `railway.json` until 2026-12-01. Before that cutoff use `railway config migrate --service chatbot-template`, review the generated preview, then migrate and apply the service partial using the CLI. Do not take ownership of the unrelated Postgres resource.

## Later switch to Live Mode

Only after approval and successful Test Mode end-to-end verification:

1. Complete credit accounting and upgrade/downgrade verification first.
2. Recreate the approved USD catalog in the intended Stripe Live account; Test product/price/customer IDs cannot be reused. Record all Live IDs and map credits/entitlements exactly.
3. Connect the correct Live Stripe account in Update.dev and configure its production webhook endpoint, signing secret, and event subscriptions. Verify signature enforcement and idempotency in the provider integration.
4. Review and change `lib/billing-environment.ts` to explicitly allow the approved Live environment. Merely setting `NODE_ENV=production` cannot activate Live billing.
5. Set the approved provider environment/key configuration in Railway, rebuild, and test a controlled Live transaction, subscription update, cancellation, and credit allocation. Keep test and live records separate.

No Stripe Live credentials or Live objects were used or changed during this work.

## Dependency review

Next.js was upgraded within the existing major version to 15.5.27, with aligned ESLint configuration, patched React, the missing Sonner dependency, and a PostCSS override. Production-only `npm audit` reports zero vulnerabilities. The complete dependency tree still reports seven high findings in development glob/lint dependencies, including a braces advisory with no compatible fix. Do not run `npm audit fix --force`, which proposes incompatible downgrades. Track these separately from runtime dependencies.

The replacement model list is based on [Anthropic model lifecycle documentation](https://platform.claude.com/docs/en/about-claude/model-deprecations). Railway configuration migration guidance is from [Railway Config as Code](https://docs.railway.com/config-as-code).
