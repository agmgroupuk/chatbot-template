import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { query } from '@/lib/db';
import type Stripe from 'stripe';
import { verifiedStripe } from '@/lib/stripe';
import { fulfillSoftwareStorefrontPayment } from '@/lib/software-storefront-fulfillment';
import { stripeObjectMatchesMode } from '@/lib/billing-environment';
import styles from '../checkout.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Software payment status',
  description: 'Check the status of your software inquiry payment.',
};

export default async function SoftwareCheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await currentUser();
  const purchaseId = typeof params.purchase_id === 'string' ? params.purchase_id : '';
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/software/checkout/complete?purchase_id=${purchaseId}`)}`);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(purchaseId)) notFound();

  const [record] = await query<{
    stripe_payment_intent_id: string | null;
    item_name: string;
    amount_paid_cents: number;
    currency: string;
    status: 'pending' | 'paid' | 'failed';
  }>(
    `select stripe_payment_intent_id,item_name,amount_paid_cents,currency,status
     from software_storefront_purchases where id=$1 and user_id=$2`,
    [purchaseId, user.id],
  );
  if (!record) notFound();

  let purchase = record;
  let confirmationIssue = false;
  if (record.stripe_payment_intent_id && record.status === 'pending') {
    const stripe = await verifiedStripe();
    const intent = await stripe.paymentIntents.retrieve(record.stripe_payment_intent_id);
    if (intent.metadata.app !== 'onefin-software-store' ||
        intent.metadata.billing_scope !== 'software' ||
        intent.metadata.user_id !== user.id ||
        intent.metadata.purchase_id !== purchaseId ||
        !stripeObjectMatchesMode(intent.livemode)) notFound();
    if (intent.status === 'succeeded' || intent.status === 'canceled') {
      try {
        await fulfillSoftwareStorefrontPayment(stripe, {
          id: `software-purchase-return:${intent.id}`,
          type: intent.status === 'succeeded' ? 'payment_intent.succeeded' : 'payment_intent.canceled',
          livemode: intent.livemode,
          data: { object: { id: intent.id } },
        } as Stripe.Event);
      } catch (error) {
        console.error('Unable to fulfill Software payment return:', error);
        confirmationIssue = true;
      }
      const [updated] = await query<typeof record>(
        `select stripe_payment_intent_id,item_name,amount_paid_cents,currency,status
         from software_storefront_purchases where id=$1 and user_id=$2`,
        [purchaseId, user.id],
      );
      if (updated) purchase = updated;
    }
  }

  const paid = purchase.status === 'paid';
  return (
    <div className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <span className={styles.eyebrow}>{paid ? 'PAYMENT CONFIRMED' : purchase.status === 'failed' ? 'PAYMENT NOT COMPLETED' : 'PAYMENT PROCESSING'}</span>
        <h1>{paid ? 'Your inquiry is on its way.' : purchase.status === 'failed' ? 'Your payment was not completed.' : 'We are confirming your payment.'}</h1>
        <p className={styles.intro}>
          {paid
            ? `Your payment of $${(purchase.amount_paid_cents / 100).toFixed(2)} ${purchase.currency.toUpperCase()} for ${purchase.item_name} was confirmed. Our team will follow up at ${user.email}.`
            : purchase.status === 'failed'
              ? `The payment for ${purchase.item_name} did not complete. No successful payment was recorded.`
              : confirmationIssue
                ? `Stripe has returned a payment status for ${purchase.item_name}, but we could not finish processing the inquiry. Please contact support and include reference ${purchaseId}.`
                : `The payment for ${purchase.item_name} is still being confirmed. This inquiry will only be marked paid after Stripe verifies it.`}
        </p>
        <div className={styles.summary}>
          <span>Software purchase</span>
          <strong>{purchase.item_name}</strong>
          <div><span>Payment</span><b>${(purchase.amount_paid_cents / 100).toFixed(2)} USD</b></div>
          <div><span>Status</span><b>{purchase.status}</b></div>
        </div>
        <div className="button-row">
          <Link className={styles.back} href="/software/account">Open Software account →</Link>
          <Link className={styles.back} href="/software">Return to software catalog</Link>
        </div>
      </section>
    </div>
  );
}
