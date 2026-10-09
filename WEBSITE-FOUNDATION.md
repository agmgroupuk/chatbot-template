# Website foundation

The public site now includes a homepage, About, Contact, searchable Help Center, Pricing, Privacy, Terms, and Payment/Cancellation/Refund Policy. Shared desktop/mobile navigation and the footer link all primary routes. Password recovery, reset-link validation, sign-in, signup, and email confirmation use the existing secure authentication service.

Pricing always renders without Stripe configuration. All four intervals are visible. Daily/Weekly use pricing inquiries because no approved amounts exist. Monthly/Yearly transparently display the existing test catalog; purchases remain unavailable while custom payments are unfinished. Inquiry links prefill the contact form. Do not interpret these previews as Live commercial prices.

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

## Storage and operations

Run `npm run db:migrate` before serving the updated app. Migration `003_website_foundation.sql` adds account settings and support requests, with row-level isolation. It preserves existing user, payment, membership, and chat identities. The health endpoint requires all three migrations.

Support requests are stored in `support_requests`, protected by server validation and rate limits. Guest requests are not linked to an existing account merely because the email matches. Authorized database operators can update `status` (`open`, `in_progress`, `resolved`) and `response`; users can only read their own tickets. The UI confirms recording, not email delivery. Staff administration and automated support notifications are not implemented.

SMTP configuration remains necessary for signup confirmation and password-reset email. Required names are `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM`. No external delivery is claimed without verifying it. One Fin sends account email through its own configured provider.

Legal content describes the implemented service and keeps mandatory consumer rights intact. It is not a certification of worldwide legal compliance. Confirm business-specific retention, licensing terms, tax treatment, and contact disclosures before accepting Live purchases. Primary reference for data rights: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng.

## Verification

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

After building: `npx playwright install chromium --only-shell`, then `npm run test:website`. The browser suite starts an in-memory PGlite database through the official socket adapter and an isolated local app, seeds synthetic users, and exercises public pages, responsive navigation, account forms, recovery, tenant-scoped exports and support, and real preference behavior. It never uses Railway or payment/AI providers. Screenshots and local logs go to ignored `.test-artifacts/website/`.

PGlite socket reference: https://pglite.dev/docs/pglite-socket. Real PostgreSQL/provider verification still matters for deployment; a local browser test does not establish inbox delivery or payment processing.
