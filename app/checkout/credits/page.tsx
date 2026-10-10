import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WorkspaceCreditCheckout } from '@/components/workspace-credit-checkout';
import { currentUser } from '@/lib/session';
import { workspaceCreditPack } from '@/lib/workspace-credit-pack';
import { sitePath } from '@/lib/site-url';

export const metadata = {
  title: 'Add Workspace credits | One Fin Solution',
  robots: { index: false, follow: false },
};

export default async function CheckoutCreditsPage() {
  const user = await currentUser();
  if (!user) redirect(sitePath('/sign-in'));

  const pack = workspaceCreditPack;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  if (!publishableKey) throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required.');

  return (
    <div className="page-wrap">
      <p className="eyebrow">Secure checkout</p>
      <h1>Add {pack.credits} Workspace credits</h1>
      <p className="lede">
        One-time card payment of ${(pack.amount / 100).toFixed(2)} {pack.currency.toUpperCase()}. Credits never expire
        and are used only for Workspace AI tasks.
      </p>
      <p className="muted">Signed in as {user.email}</p>
      <WorkspaceCreditCheckout mode="credits" publishableKey={publishableKey} />
      <p>
        <Link className="text-link" href={sitePath('/workspace?billing=cancelled')}>
          Cancel and return to Workspace
        </Link>
      </p>
    </div>
  );
}
