import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { query } from '@/lib/db';
import { readPreferences, readProfile } from '@/lib/account-service';
import { saveWorkspacePreferencesAction } from '@/app/account-actions';
import { WorkspaceCreditCheckout } from '@/components/workspace-credit-checkout';
import { SubmitButton } from '@/components/submit-button';

export const metadata = {
  title: 'Workspace setup',
  robots: { index: false, follow: false },
};

export default async function AccountWorkspacePage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const [profile, preferences] = await Promise.all([readProfile(user.id), readPreferences(user.id)]);

  let balance = '0';
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;
  try {
    const balanceRows = await query<{ balance: string }>('select available_credits($1)::text as balance', [user.id]);
    const cardRows = await query<{ card_brand: string | null; card_last4: string | null }>(
      'select card_brand, card_last4 from workspace_credit_settings where user_id=$1 limit 1',
      [user.id],
    );
    balance = balanceRows[0]?.balance || '0';
    cardBrand = cardRows[0]?.card_brand || null;
    cardLast4 = cardRows[0]?.card_last4 || null;
  } catch {
    /* workspace tables may be unavailable in some environments */
  }

  return (
    <>
      <section className="panel stack">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Workspace setup</h2>
          <p className="muted">
            Configure Workspace-only options here. Personal account details, modules, subscriptions, and payment methods stay in the
            Settings popup from chat.
          </p>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="muted">Signed in as</span>
            <strong>{profile?.fullName || profile?.name || 'Member'}</strong>
            <span className="muted text-sm">{user.email}</span>
          </div>
          <div className="stat-card">
            <span className="muted">Credit balance</span>
            <strong>{balance}</strong>
            <span className="muted text-sm">Workspace usage draws from this balance</span>
          </div>
          <div className="stat-card">
            <span className="muted">Workspace card</span>
            <strong>{cardLast4 ? `${(cardBrand || 'Card').toString()} ···· ${cardLast4}` : 'Not saved'}</strong>
            <span className="muted text-sm">Used for Workspace credit purchases</span>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div>
          <h3>Workspace preferences</h3>
          <p className="muted">Appearance and editor behavior used when you work in Workspace.</p>
        </div>
        <form action={saveWorkspacePreferencesAction} className="stack">
          <label className="field">
            <span>Theme</span>
            <select name="theme" defaultValue={preferences.theme}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="field">
            <span>Time zone</span>
            <input name="timezone" defaultValue={preferences.timezone} placeholder="Asia/Bangkok" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="enter_to_send" defaultChecked={preferences.enter_to_send} />
            Press Enter to send messages
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="spellcheck" defaultChecked={preferences.spellcheck} />
            Enable spellcheck
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="context_enabled" defaultChecked={preferences.context_enabled} />
            Keep conversation context enabled
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="product_updates" defaultChecked={preferences.product_updates} />
            Product update emails
          </label>
          <div className="button-row">
            <SubmitButton>Save Workspace settings</SubmitButton>
            <Link className="button secondary" href="/workspace">
              Open Workspace chat
            </Link>
          </div>
        </form>
      </section>

      <section className="panel stack">
        <div>
          <h3>Buy Workspace credits</h3>
          <p className="muted">Top up credits used only for Workspace AI tasks. Homepage plans remain separate.</p>
        </div>
        {publishableKey ? (
          <WorkspaceCreditCheckout mode="credits" publishableKey={publishableKey} />
        ) : (
          <p className="notice error">Stripe publishable key is not configured.</p>
        )}
      </section>

      <section className="panel stack">
        <div>
          <h3>Workspace payment card</h3>
          <p className="muted">Save or update the card used for Workspace credit purchases.</p>
        </div>
        {publishableKey ? (
          <WorkspaceCreditCheckout mode="card" publishableKey={publishableKey} />
        ) : (
          <p className="notice error">Stripe publishable key is not configured.</p>
        )}
      </section>

      <section className="panel stack">
        <div>
          <h3>Need account settings instead?</h3>
          <p className="muted">
            Profile, billing address, modules, subscriptions, password, and payment methods are managed in the Settings popup on the
            main chat screen.
          </p>
        </div>
        <div className="button-row">
          <Link className="button secondary" href="/">
            Back to chat & open Settings
          </Link>
          <Link className="button secondary" href="/dashboard/billing">
            Plans & billing page
          </Link>
        </div>
      </section>
    </>
  );
}
