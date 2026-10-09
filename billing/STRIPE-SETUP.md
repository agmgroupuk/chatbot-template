# Stripe setup continuation

Superseded architecture: the merchant subsequently required custom checkout on One Fin's domain, no Stripe Checkout or hosted payment pages, One Fin email delivery, and global sales. Follow `STRIPE-INTEGRATION-REVIEW.md` for the current plan. The steps below describe the earlier hosted implementation and must not be treated as the target architecture.

Reviewed 2026-10-10 using the Stripe implementation planner.

- Account: ONE FIN SOLUTION COMPANY LIMITED sandbox, `acct_1UOhth9TlJVLQeem`.
- Planner guide: `iguide_61VY6tZfgZowVDaFa419TlJVLQeem` (accepted).
- Integration: hosted Checkout, flat-rate monthly/annual subscriptions, and one-time credit packs.
- Signup: free credits without a payment method; paid credits require confirmed payment.
- Management: existing custom subscription UI/API; changes at renewal without proration and cancellation at period end.
- Recovery: Smart Retries and failed-payment emails recommended; account settings have not been verified or changed.
- Tax: business obligations and registrations remain unknown. No tax decision or collection setting was applied.

## Current verified state

The connected sandbox has two unrelated, unmarked products and no webhook endpoints. No application-managed products were found. Existing objects were left unchanged.

The repository has the Test catalog and provisioning script, but no local Stripe credential file or generated catalog IDs. The connector does not supply a server API key to the application. Checkout and webhook code already exist; actual end-to-end payments remain unverified.

## Next setup steps

1. Configure a Test secret key for this exact sandbox in ignored `.env.local` (or the deployment secret store), together with `STRIPE_EXPECTED_ACCOUNT_ID=acct_1UOhth9TlJVLQeem`, `STRIPE_MODE=test`, and `NEXT_PUBLIC_SITE_URL=https://onefinsolution.online`. Never put a secret in chat or source control.
2. Run `node scripts/provision-stripe.mjs` and verify the account, mode, and catalog against `billing/test-catalog.json`.
3. Run `node scripts/provision-stripe.mjs --apply` to provision the three managed products, five prices, and signed webhook. Preserve the new signing secret in the ignored generated file.
4. Configure the application with `BILLING_PROVIDER=stripe`, the exact generated `STRIPE_CREDIT_PLANS` mapping, and `STRIPE_WEBHOOK_SECRET`. Follow `DEPLOYMENT.md` for Railway configuration.
5. Verify paid, declined, and cancelled Test checkouts; duplicate and out-of-order webhook delivery; renewal, scheduled plan changes, cancellation, and credit expiry. A successful redirect alone does not establish payment or fulfillment.

Use the existing test amounts only. Live pricing and deployment require separate business decisions and completed Test verification.

Planner reference: https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted
