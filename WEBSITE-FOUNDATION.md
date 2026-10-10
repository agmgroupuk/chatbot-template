# Website foundation

The homepage opens directly into a full-height chat workspace with a conversation sidebar, new-chat action, conversation starters, and message composer. People can send unlimited messages without signing in or creating an account; guest conversations remain in the current page session and are not saved. Request throttling remains in place to protect the service from abuse. The sidebar links to profile, settings, sign-in, plans, help, and About; the public site also includes Contact, searchable Help Center, Pricing, Privacy, Terms, and Payment/Cancellation/Refund Policy. Password recovery, reset-link validation, sign-in, signup, and email confirmation use the existing secure authentication service.

Pricing shows Daily USD 5, Weekly USD 13, Monthly USD 30, Yearly USD 249, and Business contact sales. Card-backed trials last 1, 2, 3, and 5 days respectively. Personal memberships have unlimited responses. See [Plans and workspace](billing/PLANS-AND-WORKSPACE.md) for the custom payment flow and operational prerequisites. Stripe remains sandbox-only.

## Account features

- `/dashboard`: real credit balance, counts, recent conversations, plan snapshot, and credit activity.
- `/dashboard/activity`: conversation search, reopen, and explicit-confirmation deletion.
- `/dashboard/billing`: stored subscription history, cancellation/reactivation through existing server ownership checks, and credit expiry records.
- `/dashboard/support`: only requests linked to the authenticated user, with status and staff response.
- `/account`: name, unique username, website, verified email, and sign-out.
- `/account/preferences`: database-backed appearance, time zone, Enter-to-send, spellcheck, saved-context attachment, and optional product-update preference.
- `/account/plugins`: actual built-in tools and model preferences; unconnected third-party plugins are identified honestly.
- `/account/security`: current-password-verified password changes and revocation of other sessions. Password changes revoke all sessions and outstanding reset tokens.
- `/account/privacy`: scoped JSON export, content-management links, and verified-ownership account-deletion request.

The shared header and chat tools read account status and preferences from one uncached, session-scoped GET endpoint. Navigation cancels stale reads, so background account refreshes do not enter the server-action queue used to save forms.

## Storage and operations

Run `npm run db:migrate` before serving the updated app. Migration `003_website_foundation.sql` adds account settings and support requests, with row-level isolation. It preserves existing user, payment, membership, and chat identities. The health endpoint requires all four migrations.

Support requests are stored in `support_requests`, protected by server validation and rate limits. Guest requests are not linked to an existing account merely because the email matches. Authorized database operators can update `status` (`open`, `in_progress`, `resolved`) and `response`; users can only read their own tickets. The UI confirms recording, not email delivery. Staff administration and automated support notifications are not implemented.

SMTP configuration remains necessary for signup confirmation and password-reset email. Required names are `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM`. No external delivery is claimed without verifying it. One Fin sends account email through its own configured provider.

Legal content describes the implemented service and keeps mandatory consumer rights intact. It is not a certification of worldwide legal compliance. Confirm business-specific retention, licensing terms, tax treatment, and contact disclosures before accepting Live purchases. Primary reference for data rights: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng.

## Verification

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

Verified October 10, 2026: 20 backend tests and 41 isolated browser checks passed, along with TypeScript, lint, and the production build. Desktop dashboard and mobile pricing screenshots were visually reviewed. Browser checks cover profile/preference persistence, password reset, support ownership, private exports, conversation deletion, and mobile navigation.

After building: `npx playwright install chromium --only-shell`, then `npm run test:website`. The browser suite starts an isolated local PostgreSQL 16 database and app, seeds synthetic users, and exercises public pages, responsive navigation, account forms, recovery, tenant-scoped exports and support, and real preference behavior. It never uses Railway or payment/AI providers. Screenshots and local logs go to ignored `.test-artifacts/website/`.

The browser suite uses embedded-postgres to run real PostgreSQL locally. It keeps fixture data in ignored .test-artifacts/website/ and never connects to the production database. A local browser test does not establish inbox delivery or payment processing.
