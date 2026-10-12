import 'server-only';
import Stripe from 'stripe';
import { query, transaction } from '@/lib/db';
import { sendBillingEmail } from '@/lib/email';
import { getSoftwarePurchaseItem } from '@/lib/software-purchase';
import { stripeObjectMatchesMode } from '@/lib/billing-environment';

export async function fulfillSoftwareStorefrontPayment(stripe: Stripe, event: Stripe.Event) {
  if (!['payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled'].includes(event.type)) return;
  const eventIntent = event.data.object as Stripe.PaymentIntent;
  if (eventIntent.metadata?.app !== 'onefin-software-store' || eventIntent.metadata.billing_scope !== 'software') return;

  const intent = await stripe.paymentIntents.retrieve(eventIntent.id, { expand: ['payment_method'] });
  const metadata = intent.metadata;
  const item = getSoftwarePurchaseItem(metadata.item_kind, metadata.item_id);
  const amount = intent.amount_received || intent.amount;
  if (!item || !stripeObjectMatchesMode(intent.livemode) ||
      intent.currency !== 'usd' || amount < 500 || amount > item.priceCents ||
      Number(metadata.full_price_cents) !== item.priceCents ||
      !metadata.user_id || !metadata.purchase_id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(metadata.user_id) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(metadata.purchase_id)) {
    throw new Error('Unexpected software storefront payment details.');
  }

  const stripeCustomerId = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id;
  if (!stripeCustomerId) throw new Error('Software payment is missing its billing customer.');
  const [mapping] = await query<{ user_id: string }>(
    'select user_id from software_billing_customers where customer_id=$1',
    [stripeCustomerId],
  );
  if (!mapping || mapping.user_id !== metadata.user_id) throw new Error('Software payment customer ownership mismatch.');

  const [purchase] = await query<{
    id: string;
    user_id: string;
    item_kind: string;
    item_id: string;
    amount_paid_cents: number;
    total_price_cents: number;
    status: 'pending' | 'paid' | 'failed';
  }>(
    `select id,user_id,item_kind,item_id,amount_paid_cents,total_price_cents,status
     from software_storefront_purchases where id=$1 and stripe_payment_intent_id=$2`,
    [metadata.purchase_id, intent.id],
  );
  if (!purchase || purchase.user_id !== metadata.user_id || purchase.item_kind !== item.kind ||
      purchase.item_id !== item.id || purchase.amount_paid_cents !== intent.amount ||
      purchase.total_price_cents !== item.priceCents) {
    throw new Error('Software storefront purchase record does not match Stripe.');
  }

  if (event.type === 'payment_intent.succeeded') {
    if (intent.status !== 'succeeded' || intent.amount_received !== intent.amount) {
      throw new Error('Software payment is not fully captured.');
    }
    if (metadata.save_payment_method === 'true') {
      const method = intent.payment_method;
      const methodCustomer = typeof method === 'object' && method
        ? typeof method.customer === 'string' ? method.customer : method.customer?.id
        : null;
      if (!method || typeof method === 'string' || methodCustomer !== stripeCustomerId || method.type !== 'card') {
        throw new Error('Saved Software payment method ownership could not be verified.');
      }
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: method.id },
      });
    }
    await query(
      `update software_storefront_purchases set status='paid',paid_at=coalesce(paid_at,now())
       where id=$1 and user_id=$2 and status<>'paid'`,
      [purchase.id, purchase.user_id],
    );
  } else if (purchase.status !== 'paid') {
    await query(
      `update software_storefront_purchases set status='failed'
       where id=$1 and user_id=$2 and status='pending'`,
      [purchase.id, purchase.user_id],
    );
    return;
  }

  if (event.type !== 'payment_intent.succeeded') return;
  const recipient = process.env.SOFTWARE_INQUIRY_EMAIL?.trim() || process.env.EMAIL_REPLY_TO?.trim();
  if (!recipient) throw new Error('Configure SOFTWARE_INQUIRY_EMAIL or EMAIL_REPLY_TO to notify the team of storefront payments.');

  const customerEmail = typeof intent.receipt_email === 'string'
    ? intent.receipt_email
    : typeof intent.customer === 'object' && intent.customer && !intent.customer.deleted
      ? intent.customer.email || ''
      : '';
  await transaction(async (client) => {
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [intent.id]);
    const { rows } = await client.query<{ team_notified_at: Date | null }>(
      'select team_notified_at from software_storefront_purchases where id=$1 for update',
      [purchase.id],
    );
    const saved = rows[0];
    if (!saved) throw new Error('Software storefront purchase record unavailable.');
    if (saved.team_notified_at) return;

    await sendBillingEmail(
      recipient,
      'New software storefront payment',
      [
        `Product: ${item.name}`,
        `Type: ${item.kind}`,
        `Customer: ${customerEmail || 'Not provided'}`,
        `Amount paid: $${(intent.amount_received / 100).toFixed(2)} USD`,
        `Listed price: $${(item.priceCents / 100).toFixed(2)} USD`,
        `Stripe PaymentIntent: ${intent.id}`,
        `Customer dashboard: https://onefinsolution.online/software/account`,
      ].join('\n'),
      `software-storefront:${intent.id}`,
    );
    await client.query(
      'update software_storefront_purchases set team_notified_at=now() where id=$1',
      [purchase.id],
    );
  });
}
