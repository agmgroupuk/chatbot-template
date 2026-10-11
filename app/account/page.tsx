import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { query } from '@/lib/db';
import { readWorkspacePreferences } from '@/lib/account-service';
import { readWorkspaceBillingProfile } from '@/lib/workspace-billing-profile';
import { WorkspaceCreditCheckout } from '@/components/workspace-credit-checkout';
import { WorkspaceBillingProfileForm } from '@/components/workspace-billing-profile-form';
import { WorkspacePaymentMethodsPanel } from '@/components/workspace-payment-methods-panel';
import { WorkspacePreferencesForm } from '@/components/workspace-preferences-form';

export const metadata = {
  title: 'Workspace setup',
  robots: { index: false, follow: false },
};

export default async function AccountWorkspacePage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const [profile, preferences] = await Promise.all([
    readWorkspaceBillingProfile(user.id),
    readWorkspacePreferences(user.id),
  ]);

  let balance: string | null = null;
  let balanceError = false;
  try {
    const [row] = await query<{ balance: string }>(
      'select available_credits($1)::text as balance',
      [user.id],
    );
    balance = row?.balance || '0';
  } catch (error) {
    console.error('Unable to load Workspace credit balance:', error);
    balanceError = true;
  }

  return (
    <>
      <section className="panel stack">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Workspace setup</h2>
          <p className="muted">
            Manage your Workspace profile, billing, credits, payment methods, and preferences. These details are
            isolated from homepage subscription billing.
          </p>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="muted">Workspace account</span>
            <strong>{profile.fullName || 'Member'}</strong>
            <span className="muted text-sm">{user.email}</span>
          </div>
          <div className="stat-card">
            <span className="muted">Available credits</span>
            <strong>{balance ?? 'Unavailable'}</strong>
            <span className="muted text-sm">Only Workspace tasks use this balance.</span>
          </div>
        </div>
        {balanceError ? <p className="notice error">Workspace credit balance is temporarily unavailable.</p> : null}
      </section>

      <section className="panel stack">
        <div>
          <h3>Workspace profile and addresses</h3>
          <p className="muted">Your Workspace identity, billing address, and shipping address are stored separately.</p>
        </div>
        <WorkspaceBillingProfileForm profile={profile} />
      </section>

      <section className="panel stack">
        <div>
          <h3>Workspace preferences</h3>
          <p className="muted">Appearance and editor behavior used when you work in Workspace.</p>
        </div>
        <WorkspacePreferencesForm settings={preferences} />
      </section>

      <section className="panel stack">
        <div>
          <h3>Add Workspace credits</h3>
          <p className="muted">Purchase credit packs for Workspace tasks. Homepage subscription plans remain separate.</p>
        </div>
        {publishableKey ? (
          <WorkspaceCreditCheckout mode="credits" publishableKey={publishableKey} />
        ) : (
          <p className="notice error">Stripe publishable key is not configured.</p>
        )}
      </section>

      <section className="panel stack">
        <div>
          <h3>Workspace payment methods</h3>
          <p className="muted">Manage the cards and default payment method used for Workspace credit purchases.</p>
        </div>
        <WorkspacePaymentMethodsPanel publishableKey={publishableKey} />
      </section>

      <section className="panel stack">
        <div>
          <h3>Subscription account</h3>
          <p className="muted">
            Homepage subscriptions and their saved payment methods are managed separately in your main account.
          </p>
        </div>
        <div className="button-row">
          <Link className="button secondary" href="/">
            Return to homepage
          </Link>
          <Link className="button secondary" href="/dashboard/billing">
            Open subscription billing
          </Link>
          <Link className="text-link" href="/workspace">
            Open Workspace
          </Link>
        </div>
      </section>
    </>
  );
}
