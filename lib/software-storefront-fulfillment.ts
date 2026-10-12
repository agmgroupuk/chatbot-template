import 'server-only';
import Stripe from 'stripe';
import { query, transaction } from '@/lib/db';
import { sendBillingEmail } from '@/lib/email';
import { getSoftwarePurchaseItem } from '@/lib/software-purchase';
import { stripeObjectMatchesMode } from '@/lib/billing-environment';

export async function fulfillSoftwareStorefrontPayment(stripe: Stripe, event: Stripe.Event) {
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return;

  const eventSession = event.data.object as Stripe.Checkout.Session;
  if (eventSession.metadata?.app !== 'onefin-software-store' || eventSession.metadata.flow !== 'template-purchase') return;

  const session = await stripe.checkout.sessions.retrieve(eventSession.id);
  const metadata = session.metadata;
  const item = getSoftwarePurchaseItem(metadata?.item_kind, metadata?.item_id);
  const expectedPrice = item && Number(metadata?.full_price_cents);
  if (
    !item ||
    session.mode !== 'payment' ||
    !stripeObjectMatchesMode(session.livemode) ||
    session.currency !== 'usd' ||
    session.amount_total === null ||
    session.amount_total < 500 ||
    session.amount_total > item.priceCents ||
    expectedPrice !== item.priceCents
  ) {
    throw new Error('Unexpected software storefront payment details.');
  }

  const paymentAmount = session.amount_total;
  const customerEmail = session.customer_details?.email || session.customer_email || null;
  const paid = session.payment_status === 'paid';
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id || null;
  await query(
    `insert into software_storefront_purchases (
       stripe_checkout_session_id, stripe_payment_intent_id, item_kind, item_id, item_name,
       customer_email, amount_paid_cents, total_price_cents, currency, status, paid_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,'usd',$9,case when $9='paid' then now() else null end)
     on conflict (stripe_checkout_session_id) do update set
       stripe_payment_intent_id=coalesce(excluded.stripe_payment_intent_id,software_storefront_purchases.stripe_payment_intent_id),
       customer_email=coalesce(excluded.customer_email,software_storefront_purchases.customer_email),
       status=case when software_storefront_purchases.status='paid' then 'paid' else excluded.status end,
       paid_at=coalesce(software_storefront_purchases.paid_at,excluded.paid_at)`,
    [
      session.id,
      paymentIntentId,
      item.kind,
      item.id,
      item.name,
      customerEmail,
      paymentAmount,
      item.priceCents,
      paid ? 'paid' : 'pending',
    ],
  );

  if (!paid) return;
  const recipient = process.env.SOFTWARE_INQUIRY_EMAIL?.trim() || process.env.EMAIL_REPLY_TO?.trim();
  if (!recipient) throw new Error('Configure SOFTWARE_INQUIRY_EMAIL or EMAIL_REPLY_TO to notify the team of storefront payments.');

  await transaction(async (client) => {
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [session.id]);
    const { rows } = await client.query<{ team_notified_at: Date | null }>(
      'select team_notified_at from software_storefront_purchases where stripe_checkout_session_id=$1',
      [session.id],
    );
    const purchase = rows[0];
    if (!purchase) throw new Error('Software storefront purchase record unavailable.');
    if (purchase.team_notified_at) return;

    await sendBillingEmail(
      recipient,
      'New software storefront payment',
      [
        `Product: ${item.name}`,
        `Type: ${item.kind}`,
        `Customer: ${customerEmail || 'Not provided'}`,
        `Amount paid: $${(paymentAmount / 100).toFixed(2)} USD`,
        `Listed price: $${(item.priceCents / 100).toFixed(2)} USD`,
        `Stripe Checkout session: ${session.id}`,
      ].join('\n'),
      `software-storefront:${session.id}`,
    );
    await client.query(
      'update software_storefront_purchases set team_notified_at=now() where stripe_checkout_session_id=$1',
      [session.id],
    );
  });
}
