> Update October 10, 2026: homepage chat subscriptions use custom Stripe Elements at `pay.onefinsolution.online`, card-first trials, and next-renewal switching. Workspace credits use a separate one-time pack and PaymentIntent flow. See [Plans and workspace](PLANS-AND-WORKSPACE.md) for current pricing, runtime prerequisites, and Sandbox verification. Earlier hosted Checkout instructions below are historical and must not be used.

# Stripe setup continuation

Superseded architecture: the merchant subsequently required custom checkout on One Fin's domain, no Stripe Checkout or hosted payment pages, One Fin email delivery, and global sales. Follow this document's current-state notes and [Plans and workspace](PLANS-AND-WORKSPACE.md) for the current plan. The steps below describe the earlier hosted implementation and must not be treated as the target architecture.

Reviewed 2026-10-10 using the Stripe implementation planner.

- Account: ONE FIN SOLUTION COMPANY LIMITED sandbox, `acct_1UOhth9TlJVLQeem`.
- Planner guide: `iguide_61VY6tZfgZowVDaFa419TlJVLQeem` (accepted).
- Historical integration: hosted Checkout, flat-rate monthly/annual subscriptions, and one-time credit packs.
- Signup: any configured signup credits belong to Workspace only and do not grant homepage chat access.
- Management: existing custom subscription UI/API; changes at renewal without proration and cancellation at period end.
- Recovery: Smart Retries and failed-payment emails recommended; account settings have not been verified or changed.
- Tax: business obligations and registrations remain unknown. No tax decision or collection setting was applied.

## Current verified state

The connected Sandbox inspection found the four active recurring `onefin_v2_*` personal subscription prices, matching the source catalog, and an enabled webhook endpoint at `https://onefinsolution.online/api/stripe/webhook`. That endpoint includes subscription lifecycle and invoice payment-failure/action-required events. The application webhook now forwards those invoice events to billing fulfillment. Stripe and Railway were not modified as part of this code change.

The reviewed Railway production variable-name listing did not include `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, or `STRIPE_CREDIT_PLANS`; the values were not displayed. Confirm the precise service/environment before applying configuration. Health endpoints on both the main site and checkout subdomain were healthy during the review, but this does not verify payment processing. Actual end-to-end Sandbox payment lifecycle remains untested.

## Next setup steps

1. Configure the matching Sandbox secret and publishable keys for this exact account in ignored `.env.local` (or the deployment secret store), together with `STRIPE_EXPECTED_ACCOUNT_ID=acct_1UOhth9TlJVLQeem`, `STRIPE_MODE=test`, `NEXT_PUBLIC_SITE_URL=https://onefinsolution.online`, `NEXT_PUBLIC_CHECKOUT_URL=https://pay.onefinsolution.online`, and `SESSION_COOKIE_DOMAIN=.onefinsolution.online`. Never put a secret in chat or source control.
2. Run `node scripts/provision-stripe.mjs` to dry-run and verify the account, mode, and Workspace-only catalog against `billing/test-catalog.json`.
3. Only after reviewing and approving the external changes, run `node scripts/provision-stripe.mjs --apply` to provision the Workspace one-time credit-pack catalog and add the required events to the managed Sandbox webhook. Personal homepage-chat subscription prices are managed separately. Preserve a newly generated signing secret in the ignored generated file.
4. Configure the application with `BILLING_PROVIDER=stripe`, the exact generated Workspace-only `STRIPE_CREDIT_PLANS` mapping, matching Sandbox publishable key, and `STRIPE_WEBHOOK_SECRET`. Follow `DEPLOYMENT.md` for Railway configuration.
5. Verify paid, declined, and cancelled Test credit-pack payments; duplicate webhook delivery; homepage chat subscription renewal, scheduled plan changes, and cancellation; and Workspace credit fulfillment. A successful redirect alone does not establish payment or fulfillment.

Use the existing test amounts only. Live pricing and deployment require separate business decisions and completed Test verification.

Planner reference: https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted
