import 'server-only';
import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { company } from './company';
import {
  EMAIL_TEMPLATE_IDS,
  buildEmailTemplate,
  renderEmailHtml,
  renderEmailText,
  type EmailTemplateId,
  type EmailTemplateInput,
} from './email-templates';

function trimEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function emailConfigured() {
  return Boolean(
    trimEnv('RESEND_API_KEY') ||
      (trimEnv('SMTP_HOST') && trimEnv('SMTP_USER') && trimEnv('SMTP_PASSWORD') && trimEnv('EMAIL_FROM')),
  );
}

export function resolveFromAddress(kind: 'default' | 'auth' | 'billing' | 'noreply' = 'default'): string {
  const defaults =
    trimEnv('EMAIL_FROM') || trimEnv('RESEND_FROM') || `One Fin Solution <noreply@onefinsolution.online>`;
  if (kind === 'auth') return trimEnv('EMAIL_FROM_AUTH') || trimEnv('RESEND_FROM_AUTH') || defaults;
  if (kind === 'billing') return trimEnv('EMAIL_FROM_BILLING') || trimEnv('RESEND_FROM_BILLING') || defaults;
  if (kind === 'noreply') return trimEnv('EMAIL_FROM_NOREPLY') || trimEnv('RESEND_FROM_NOREPLY') || defaults;
  return defaults;
}

function resendClient(): Resend | null {
  const key = trimEnv('RESEND_API_KEY');
  return key ? new Resend(key) : null;
}

function smtpTransport() {
  const host = trimEnv('SMTP_HOST');
  const user = trimEnv('SMTP_USER');
  const pass = trimEnv('SMTP_PASSWORD');
  if (!host || !user || !pass) return null;
  const port = Number(trimEnv('SMTP_PORT') || 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function deliver(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from: string;
  reference?: string;
  tags?: Array<{ name: string; value: string }>;
  replyTo?: string;
}) {
  const to = options.to.trim().toLowerCase();
  if (!to.includes('@')) throw new Error('Invalid recipient email.');

  const resend = resendClient();
  if (resend) {
    const result = await resend.emails.send({
      from: options.from,
      to: [to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || trimEnv('EMAIL_REPLY_TO'),
      tags: options.tags,
      headers: options.reference
        ? {
            'X-Entity-Ref-ID': createHash('sha256').update(options.reference).digest('hex'),
          }
        : undefined,
    });
    if (result.error) throw new Error(result.error.message);
    return { provider: 'resend' as const, id: result.data?.id };
  }

  const transport = smtpTransport();
  if (!transport || !trimEnv('EMAIL_FROM')) {
    throw new Error('Email delivery is not configured. Set RESEND_API_KEY or SMTP credentials.');
  }

  const result = await transport.sendMail({
    from: options.from,
    to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo || trimEnv('EMAIL_REPLY_TO'),
    messageId: options.reference
      ? `<${createHash('sha256').update(options.reference).digest('hex')}@onefinsolution.online>`
      : undefined,
  });
  if (!result.accepted?.length) throw new Error('Email was not accepted.');
  return { provider: 'smtp' as const, id: typeof result.messageId === 'string' ? result.messageId : undefined };
}

export async function sendTemplateEmail(
  templateId: EmailTemplateId,
  to: string,
  input: EmailTemplateInput = {},
  options?: {
    fromKind?: 'default' | 'auth' | 'billing' | 'noreply';
    reference?: string;
    replyTo?: string;
  },
) {
  const template = buildEmailTemplate(templateId, { ...input, email: input.email || to });
  const fromKind =
    options?.fromKind ||
    (templateId === 'subscription_plan_reminder' || templateId === 'trial_reminder'
      ? 'billing'
      : 'auth');

  return deliver({
    to,
    subject: template.subject,
    html: renderEmailHtml(template),
    text: renderEmailText(template),
    from: resolveFromAddress(fromKind),
    reference: options?.reference,
    replyTo: options?.replyTo,
    tags: [
      { name: 'template', value: templateId },
      { name: 'app', value: 'onefin' },
    ],
  });
}

/** Auth magic-link / reset / verify emails (existing API used by auth-service). */
export async function sendAuthEmail(email: string, url: string, purpose: 'verify' | 'reset' | 'login') {
  if (!emailConfigured()) {
    throw new Error('Email delivery is not configured. Please contact the site administrator.');
  }

  const templateId: EmailTemplateId =
    purpose === 'verify' ? 'welcome' : purpose === 'reset' ? 'forgot_password' : 'login_reminder';

  await sendTemplateEmail(templateId, email, { actionUrl: url }, { fromKind: 'auth', reference: `${purpose}:${email}:${url}` });
}

export async function sendPasswordChangedEmail(email: string, actionUrl?: string) {
  if (!emailConfigured()) return;
  await sendTemplateEmail('password_reset', email, { actionUrl }, { fromKind: 'auth' });
}

export async function sendActivityKeyEmail(email: string, code: string, actionUrl?: string) {
  if (!emailConfigured()) {
    throw new Error('Email delivery is not configured. Please contact the site administrator.');
  }
  await sendTemplateEmail('activity_key', email, { code, actionUrl }, { fromKind: 'auth', reference: `activity:${email}:${code}` });
}

export async function sendSubscriptionReminderEmail(
  email: string,
  input: { planName?: string; periodEnd?: string; amountLabel?: string; note?: string; actionUrl?: string },
) {
  if (!emailConfigured()) return;
  await sendTemplateEmail('subscription_plan_reminder', email, input, { fromKind: 'billing' });
}

export async function sendTrialReminderEmail(
  email: string,
  input: { planName?: string; trialEnd?: string; amountLabel?: string; actionUrl?: string },
) {
  if (!emailConfigured()) return;
  await sendTemplateEmail('trial_reminder', email, input, { fromKind: 'billing' });
}

/** Existing billing notice delivery API. */
export async function sendBillingEmail(email: string, subject: string, text: string, reference: string) {
  if (!emailConfigured()) {
    throw new Error('Email delivery is not configured.');
  }

  const lower = `${subject}\n${text}`.toLowerCase();
  if (lower.includes('trial') && (lower.includes('end') || lower.includes('ending') || lower.includes('will end'))) {
    await sendTemplateEmail(
      'trial_reminder',
      email,
      {
        note: text,
        actionUrl: '/dashboard/billing',
      },
      { fromKind: 'billing', reference },
    );
    return;
  }

  if (lower.includes('subscription') || lower.includes('plan') || lower.includes('renew')) {
    await sendTemplateEmail(
      'subscription_plan_reminder',
      email,
      {
        note: text,
        actionUrl: '/dashboard/billing',
      },
      { fromKind: 'billing', reference },
    );
    return;
  }

  const html = `<!doctype html><html><body style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111827;"><p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;font-weight:700;">${company.name}</p><h1 style="font-size:22px;">${subject}</h1><pre style="white-space:pre-wrap;font-family:inherit;font-size:15px;">${text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</pre></body></html>`;
  await deliver({
    to: email,
    subject: `${subject} - One Fin`,
    html,
    text: `${company.name}\n\n${text}`,
    from: resolveFromAddress('billing'),
    reference,
    tags: [
      { name: 'template', value: 'billing_notice' },
      { name: 'app', value: 'onefin' },
    ],
  });
}

export function listEmailTemplates() {
  return EMAIL_TEMPLATE_IDS.map((id) => {
    const sample = buildEmailTemplate(id, {
      toName: 'Alex',
      email: 'alex@example.com',
      actionUrl: '/sign-in',
      code: '123456',
      planName: 'Monthly',
      trialEnd: 'March 20, 2026',
      periodEnd: 'April 1, 2026',
      amountLabel: '$9.00 USD / month',
    });
    return { id, subject: sample.subject };
  });
}

export { EMAIL_TEMPLATE_IDS, buildEmailTemplate, renderEmailHtml, renderEmailText };
export type { EmailTemplateId, EmailTemplateInput };
