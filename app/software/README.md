# One Fin Software

Standalone one-page software template and custom-development storefront for One Fin Solution.

The app uses the existing Railway PostgreSQL database through `DATABASE_URL`, while keeping this service's accounts, password-reset records, and sessions in the separate `ofs_store` schema. Its sign-in, sign-up, forgot-password, and reset-password flows open in a modal on the storefront; signup does not require email verification. Password-reset emails use this service's `SOFTWARE_RESEND_API_KEY` and `SOFTWARE_EMAIL_FROM`.

Template and service inquiries link to the main One Fin website. Purchases are not enabled yet: configure and verify a dedicated standalone Stripe account, API key, and webhook before implementing the checkout lifecycle. Do not reuse the main website's Stripe credentials.

## Local setup

1. Use Node.js 22 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL` for a PostgreSQL database where this service may create the `ofs_store` schema. Set the public `SOFTWARE_APP_URL` before testing reset emails.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

The app initializes its isolated schema on startup. Production uses the `PORT` assigned by Railway. To deploy, create a separate Railway service with this directory as its root, attach the intended PostgreSQL database, configure the service-specific variables, and map `b2b.onefinsolution.online` to the service. The main website and this storefront remain separate services.

## Checks

- `npm run lint`
- `npm run build`

Privacy, Terms, payment-policy, and contact links lead to the corresponding pages on `https://onefinsolution.online`.
