import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { verifiedStripe } from '@/lib/stripe';
import { getSoftwarePurchaseItem } from '@/lib/software-purchase';
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
  const sessionId = typeof params.session_id === 'string' ? params.session_id : '';
  if (!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) notFound();

  let session;
  try {
    session = await (await verifiedStripe()).checkout.sessions.retrieve(sessionId);
  } catch {
    notFound();
  }

  const metadata = session.metadata;
  if (
    session.mode !== 'payment' ||
    metadata?.app !== 'onefin-software-store' ||
    metadata.flow !== 'template-purchase' ||
    (session.currency !== 'usd') ||
    !metadata.item_kind ||
    !metadata.item_id
  ) notFound();

  const item = getSoftwarePurchaseItem(metadata.item_kind, metadata.item_id);
  if (!item || session.amount_total === null || session.amount_total < 500 || session.amount_total > item.priceCents) notFound();
  const paid = session.payment_status === 'paid';

  return (
    <div className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <span className={styles.eyebrow}>{paid ? 'PAYMENT CONFIRMED' : 'PAYMENT PROCESSING'}</span>
        <h1>{paid ? 'Your inquiry is on its way.' : 'We are confirming your payment.'}</h1>
        <p className={styles.intro}>
          {paid
            ? `Your payment of $${(session.amount_total / 100).toFixed(2)} USD for ${item.name} was confirmed. Our team will follow up using the email address you entered at checkout.`
            : `Your payment for ${item.name} is still processing. This page will not mark the inquiry as paid until Stripe confirms it.`}
        </p>
        <Link className={styles.back} href="/software">Return to software catalog →</Link>
      </section>
    </div>
  );
}
