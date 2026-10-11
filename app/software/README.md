# One Fin Software

Standalone one-page software template and custom-development storefront for One Fin Solution.

The app uses the existing Railway PostgreSQL database through `DATABASE_URL`, while keeping this service's accounts, password-reset records, and sessions in the separate `ofs_store` schema. Its sign-in, sign-up, forgot-password, and reset-password flows open in a modal on the storefront; signup does not require email verification. Password-reset emails use this service's `SOFTWARE_RESEND_API_KEY` and `SOFTWARE_EMAIL_FROM`.

Custom-development inquiries link to the main One Fin website. Template checkout uses Stripe Checkout in **test mode only**, backed by `ofs_store.orders` and verified by signed webhook events. It requires the dedicated B2B sandbox's `SOFTWARE_STRIPE_SECRET_KEY` (`sk_test_...`), `SOFTWARE_STRIPE_WEBHOOK_SECRET` (`whsec_...`), and the configured `SOFTWARE_APP_URL`. Never reuse the main website's Stripe credentials. Live-mode keys are rejected by the storefront.

The webhook endpoint is `https://b2b.onefinsolution.online/api/stripe/webhook`. Configure it in the B2B Stripe sandbox to deliver `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. The app stores orders and exposes each user's own purchase history. Digital template files are not present or delivered by this app yet; keep purchases in test mode until the files and fulfillment flow are ready.

## Local setup

1. Use Node.js 22.12 or later, but below Node.js 25.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL` for a PostgreSQL database where this service may create the `ofs_store` schema. Set `SOFTWARE_APP_URL` and the dedicated Stripe sandbox secrets before testing checkout.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

The app initializes its isolated schema on startup. Production uses the `PORT` assigned by Railway. To deploy, create a separate Railway service with this directory as its root, attach the intended PostgreSQL database, configure the service-specific variables, and map `b2b.onefinsolution.online` to the service. The main website and this storefront remain separate services.

## Checks

- `npm run lint`
- `npm run build`

Privacy, Terms, payment-policy, and contact links lead to the corresponding pages on `https://onefinsolution.online`.
