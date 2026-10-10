import { siteUrl } from './site-url';

export type EmailTemplateId =
  | 'welcome'
  | 'login_reminder'
  | 'forgot_password'
  | 'password_reset'
  | 'activity_key'
  | 'subscription_plan_reminder'
  | 'trial_reminder';

export type EmailTemplateInput = {
  toName?: string | null;
  email?: string;
  actionUrl?: string;
  code?: string;
  planName?: string;
  trialEnd?: string | null;
  periodEnd?: string | null;
  amountLabel?: string | null;
  note?: string | null;
};

type BuiltTemplate = {
  id: EmailTemplateId;
  subject: string;
  preheader: string;
  heading: string;
  body: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
};

const brand = {
  product: 'One Fin Solution',
  support: 'https://onefinsolution.online/support',
  privacy: 'https://onefinsolution.online/privacy',
  billing: 'https://onefinsolution.online/dashboard/billing',
  signIn: 'https://onefinsolution.online/sign-in',
  workspace: 'https://onefinsolution.online/workspace',
};

function displayName(input: EmailTemplateInput): string {
  const name = (input.toName || '').trim();
  return name || 'there';
}

function absolute(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = siteUrl().replace(/\/$/, '');
  return `${base}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

export function buildEmailTemplate(id: EmailTemplateId, input: EmailTemplateInput = {}): BuiltTemplate {
  const name = displayName(input);
  const actionUrl = absolute(input.actionUrl);

  switch (id) {
    case 'welcome':
      return {
        id,
        subject: `Welcome to ${brand.product}`,
        preheader: 'Your account is ready. Confirm your email to unlock full access.',
        heading: `Welcome, ${name}`,
        body: [
          `Thanks for creating your ${brand.product} account${input.email ? ` (${input.email})` : ''}.`,
          'Confirm your email to secure the account, then explore homepage chat plans and Workspace credits whenever you are ready.',
          'If you did not create this account, you can ignore this message.',
        ],
        ctaLabel: actionUrl ? 'Confirm email' : 'Open One Fin',
        ctaUrl: actionUrl || brand.signIn,
        footerNote: 'This confirmation link expires for your security.',
      };

    case 'login_reminder':
      return {
        id,
        subject: `Your ${brand.product} sign-in link`,
        preheader: 'Use this secure link to access your account.',
        heading: 'Sign in to your account',
        body: [
          `Hi ${name},`,
          'We received a request for a sign-in link. Use the button below to continue. The link expires soon and can only be used once.',
          'If you did not request this, you can safely ignore this email. Your password has not changed.',
        ],
        ctaLabel: 'Sign in securely',
        ctaUrl: actionUrl || brand.signIn,
      };

    case 'forgot_password':
      return {
        id,
        subject: `Reset your ${brand.product} password`,
        preheader: 'Choose a new password with this secure link.',
        heading: 'Password reset request',
        body: [
          `Hi ${name},`,
          'We received a request to reset the password for your account. Click below to choose a new password.',
          'If you did not ask for a reset, ignore this email. Your current password will keep working.',
        ],
        ctaLabel: 'Reset password',
        ctaUrl: actionUrl || `${brand.signIn.replace('/sign-in', '/forgot-password')}`,
        footerNote: 'This reset link expires for your security.',
      };

    case 'password_reset':
      return {
        id,
        subject: `Your ${brand.product} password was updated`,
        preheader: 'This is a confirmation that your password changed.',
        heading: 'Password updated',
        body: [
          `Hi ${name},`,
          'Your password was changed successfully. If you made this change, no further action is needed.',
          'If you did not change your password, reset it immediately and contact support.',
        ],
        ctaLabel: 'Review account security',
        ctaUrl: actionUrl || brand.signIn,
      };

    case 'activity_key':
      return {
        id,
        subject: `Your ${brand.product} verification code`,
        preheader: input.code ? `Your code is ${input.code}` : 'Your one-time activity key is ready.',
        heading: 'Activity verification key',
        body: [
          `Hi ${name},`,
          'Use this one-time key to complete your secure activity:',
          input.code ? `Code: ${input.code}` : 'Open the secure link below to continue.',
          'This key expires shortly and should not be shared with anyone.',
        ],
        ctaLabel: actionUrl ? 'Continue securely' : undefined,
        ctaUrl: actionUrl,
        footerNote: 'Never share this code. One Fin staff will never ask for it.',
      };

    case 'subscription_plan_reminder':
      return {
        id,
        subject: input.planName
          ? `${brand.product}: ${input.planName} plan reminder`
          : `${brand.product} subscription reminder`,
        preheader: 'A quick update about your homepage chat subscription.',
        heading: 'Subscription reminder',
        body: [
          `Hi ${name},`,
          input.planName
            ? `This is a reminder about your ${input.planName} homepage chat plan.`
            : 'This is a reminder about your homepage chat subscription.',
          input.periodEnd ? `Current period ends: ${input.periodEnd}.` : '',
          input.amountLabel ? `Upcoming charge: ${input.amountLabel}.` : '',
          input.note || 'You can switch plans, update your card, or cancel from Plans & billing before the next renewal.',
        ].filter(Boolean),
        ctaLabel: 'Manage subscription',
        ctaUrl: actionUrl || brand.billing,
      };

    case 'trial_reminder':
      return {
        id,
        subject: input.planName
          ? `${brand.product}: ${input.planName} trial ending soon`
          : `${brand.product} trial ending soon`,
        preheader: 'Your free trial is ending soon. Cancel anytime before the first charge.',
        heading: 'Trial ending soon',
        body: [
          `Hi ${name},`,
          input.planName
            ? `Your free trial of the ${input.planName} plan is ending soon.`
            : 'Your free trial is ending soon.',
          input.trialEnd ? `First automatic payment: ${input.trialEnd}.` : '',
          input.amountLabel ? `Then ${input.amountLabel}, billed automatically unless you cancel.` : '',
          input.note || 'Cancel before the trial ends to avoid the first charge. You can also keep the plan and continue unlimited homepage chat.',
        ].filter(Boolean),
        ctaLabel: 'Review trial & billing',
        ctaUrl: actionUrl || brand.billing,
      };

    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown email template: ${_exhaustive}`);
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderEmailHtml(template: BuiltTemplate): string {
  const paragraphs = template.body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2937;">${escapeHtml(line)}</p>`,
    )
    .join('');
  const cta = template.ctaUrl
    ? `<p style="margin:28px 0 8px;"><a href="${escapeHtml(template.ctaUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">${escapeHtml(template.ctaLabel || 'Continue')}</a></p>`
    : '';
  const footerNote = template.footerNote
    ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">${escapeHtml(template.footerNote)}</p>`
    : '';

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3f4f6;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(template.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px 28px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;font-weight:700;">${escapeHtml(brand.product)}</p>
                <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:#111827;">${escapeHtml(template.heading)}</h1>
                ${paragraphs}
                ${cta}
                ${footerNote}
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
                <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
                  ${escapeHtml(brand.product)} ·
                  <a href="${escapeHtml(brand.support)}" style="color:#0f766e;">Support</a> ·
                  <a href="${escapeHtml(brand.privacy)}" style="color:#0f766e;">Privacy</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderEmailText(template: BuiltTemplate): string {
  const lines = [
    template.heading,
    '',
    ...template.body,
    '',
    template.ctaUrl ? `${template.ctaLabel || 'Continue'}: ${template.ctaUrl}` : '',
    template.footerNote || '',
    '',
    `${brand.product} · ${brand.support}`,
  ].filter((line, index, arr) => !(line === '' && arr[index - 1] === ''));
  return lines.join('\n');
}

export const EMAIL_TEMPLATE_IDS: EmailTemplateId[] = [
  'welcome',
  'login_reminder',
  'forgot_password',
  'password_reset',
  'activity_key',
  'subscription_plan_reminder',
  'trial_reminder',
];
