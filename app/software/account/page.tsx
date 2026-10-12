import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { query } from '@/lib/db';
import { readSoftwareBillingProfile } from '@/lib/software-billing-profile';
import { SoftwareBillingManager } from './SoftwareBillingManager';
import styles from './software-account.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Software account and billing',
  description: 'Manage Software-only billing details, payment methods, and purchase history.',
  robots: { index: false, follow: false },
};

function usd(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export default async function SoftwareAccountPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=%2Fsoftware%2Faccount');

  const [profile, purchases] = await Promise.all([
    readSoftwareBillingProfile(user.id),
    query<{
      id: string;
      item_name: string;
      amount_paid_cents: number;
      total_price_cents: number;
      currency: string;
      status: 'pending' | 'paid' | 'failed';
      created_at: string;
      paid_at: string | null;
    }>(
      `select id,item_name,amount_paid_cents,total_price_cents,currency,status,created_at::text,paid_at::text
       from software_storefront_purchases where user_id=$1 order by created_at desc limit 100`,
      [user.id],
    ),
  ]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>SOFTWARE BILLING · USD</span>
        <h1>Your Software account</h1>
        <p>Signed in as {user.email}. This billing area has its own saved cards, addresses, and payment history, separate from your subscription and Workspace accounts.</p>
        <nav className={styles.nav} aria-label="Your billing areas">
          <Link href="/dashboard/billing">Subscription billing</Link>
          <Link href="/account">Workspace billing</Link>
          <Link href="/software">Software store</Link>
        </nav>
      </section>

      <SoftwareBillingManager
        profile={profile}
        publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
      />

      <section className={styles.section}>
        <h2>Software payment history</h2>
        <p>Payments and inquiry status recorded for your Software account only.</p>
        {purchases.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Item</th><th>Payment</th><th>Listed total</th><th>Remaining</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {purchases.map((purchase) => {
                  const paidAmount = purchase.status === 'paid' ? purchase.amount_paid_cents : 0;
                  return (
                    <tr key={purchase.id}>
                      <td>{purchase.item_name}</td>
                      <td>{purchase.status === 'paid' ? usd(paidAmount) : '—'}</td>
                      <td>{usd(purchase.total_price_cents)}</td>
                      <td>{usd(Math.max(0, purchase.total_price_cents - paidAmount))}</td>
                      <td>{purchase.status}</td>
                      <td>{new Date(purchase.paid_at || purchase.created_at).toLocaleDateString('en-US')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p>No Software payments yet.</p>}
      </section>
    </div>
  );
}
