'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { ArrowUp, CreditCard, FileText, History, LayoutGrid, Plus, Settings, Sparkles, Wallet } from 'lucide-react';
import { createWorkspaceCreditPaymentIntent, getWorkspaceBillingData, prepareWorkspaceCardUpdate, saveWorkspaceCard, workspaceCreditPurchaseStatus } from '@/app/workspace-actions';
import { workspaceCreditPack } from '@/lib/workspace-credit-pack';

type WorkspaceData =
  | {
      balance: number;
      creditCost: number;
      usage: { id: string; status: string; created_at: string; credits: number }[];
      transactions: { id: string; amount: number; currency: string; credits: number; created_at: string }[];
      card: { card_brand: string | null; card_last4: string | null; card_exp_month: number | null; card_exp_year: number | null } | null;
    }
  | { error: string };
type WorkspaceMessage = { sender: 'user' | 'ai'; content: string };

function WorkspacePaymentForm({ purchaseId, onComplete, initialData }: { purchaseId: string; onComplete: () => void; initialData: WorkspaceData }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('error' in initialData ? initialData.error : '');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: { return_url: `${location.origin}/workspace?purchase=${purchaseId}` },
      });
      if (result.error) throw new Error(result.error.message || 'The payment could not be completed.');
      if (result.paymentIntent?.status !== 'succeeded') {
        setError('Payment is still processing. Check your transaction history in a moment.');
        return;
      }
      const status = await workspaceCreditPurchaseStatus(purchaseId);
      if (status.status !== 'succeeded') throw new Error('Payment was received but credits are still syncing. Refresh the Workspace shortly.');
      onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The payment could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="workspace-payment-form" onSubmit={submit}>
      <PaymentElement />
      {error && <p className="workspace-alert" role="alert">{error}</p>}
      <button className="workspace-primary-button" type="submit" disabled={!stripe || busy}>
        {busy ? 'Processing payment…' : `Pay $${(workspaceCreditPack.amount / 100).toFixed(2)} USD`}
      </button>
      <p className="workspace-muted-copy">One-time payment. This does not start a subscription.</p>
    </form>
  );
}

function WorkspaceCardForm({ onComplete }: { onComplete: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: { return_url: `${location.origin}/workspace` },
      });
      if (result.error) throw new Error(result.error.message || 'Card verification failed.');
      if (result.setupIntent?.status !== 'succeeded') throw new Error('Card verification is still processing.');
      const saved = await saveWorkspaceCard(result.setupIntent.id);
      if (saved.error) throw new Error(saved.error);
      onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save payment method.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="workspace-payment-form" onSubmit={submit}>
      <PaymentElement />
      {error && <p className="workspace-alert" role="alert">{error}</p>}
      <button className="workspace-primary-button" type="submit" disabled={!stripe || busy}>
        {busy ? 'Verifying card…' : 'Save Workspace payment method'}
      </button>
      <p className="workspace-muted-copy">Saving a card does not enable automatic or scheduled charges.</p>
    </form>
  );
}

export function WorkspaceApplication({
  email,
  isAuthenticated,
  publishableKey,
  initialData,
  paymentConfirmed,
}: {
  email: string | null;
  isAuthenticated: boolean;
  publishableKey: string;
  initialData: WorkspaceData;
  paymentConfirmed: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData>(initialData);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [paymentSecret, setPaymentSecret] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [purchaseId, setPurchaseId] = useState('');
  const [accessPrompt, setAccessPrompt] = useState<'signin' | 'credits' | null>(null);
  const stripePromise = useMemo(() => publishableKey ? loadStripe(publishableKey) : null, [publishableKey]);
  const balance = 'balance' in data ? data.balance : null;
  const transactions = 'transactions' in data ? data.transactions : [];
  const usage = 'usage' in data ? data.usage : [];
  const card = 'card' in data ? data.card : null;

  const refreshData = useCallback(async () => {
    setLoading(true);
    const next = await getWorkspaceBillingData();
    setData(next);
    setLoading(false);
    if ('error' in next) setError(next.error || 'Workspace billing data is temporarily unavailable.');
    else setError('');
  }, []);

  useEffect(() => {
    if (paymentConfirmed) setNotice('Your Workspace credit purchase is complete.');
    const params = new URLSearchParams(window.location.search);
    const setupIntentId = params.get('setup_intent');
    if (params.has('purchase') || setupIntentId) {
      router.replace('/workspace', { scroll: false });
    }
    if (!setupIntentId) return;

    let active = true;
    setNotice('Verifying your Workspace payment method…');
    void saveWorkspaceCard(setupIntentId)
      .then((result) => {
        if (!active) return;
        if (result.error) setError(result.error);
        else {
          setError('');
          setNotice('Workspace payment method saved.');
          void refreshData();
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Unable to verify the saved payment method.');
      });
    return () => { active = false; };
  }, [paymentConfirmed, refreshData, router]);

  async function sendTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    if (!isAuthenticated) {
      setAccessPrompt('signin');
      return;
    }
    if (balance !== null && 'creditCost' in data && balance < data.creditCost) {
      setAccessPrompt('credits');
      return;
    }
    const optimistic = [...messages, { sender: 'user' as const, content: text }].slice(-19);
    const requestMessages = optimistic.map((message) => ({ ...message, content: message.content.slice(0, 4000) }));
    while (requestMessages.length > 1 && requestMessages.reduce((total, message) => total + message.content.length, 0) > 16000) {
      requestMessages.shift();
    }
    setMessages(optimistic);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: requestMessages }),
      });
      const result = await response.json() as { answer?: string; balance?: number; error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to complete this Workspace task.');
      const answer = result.answer;
      const nextBalance = result.balance;
      if (typeof answer !== 'string' || typeof nextBalance !== 'number') throw new Error('The Workspace returned an invalid response.');
      setMessages([...optimistic, { sender: 'ai', content: answer }]);
      setPrompt('');
      setData((previous) => 'balance' in previous ? { ...previous, balance: nextBalance } : previous);
      void refreshData();
    } catch (failure) {
      setMessages(messages);
      const message = failure instanceof Error ? failure.message : 'Unable to complete this Workspace task.';
      if (message.includes('Not enough Workspace credits')) {
        setAccessPrompt('credits');
        setError('');
        setNotice('');
      } else if (message.includes('Please sign in')) {
        setAccessPrompt('signin');
        setError('');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function beginPurchase() {
    if (!isAuthenticated) {
      setAccessPrompt('signin');
      return;
    }
    setError('');
    setNotice('');
    const id = crypto.randomUUID();
    const result = await createWorkspaceCreditPaymentIntent(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPurchaseId(id);
    setPaymentSecret(result.clientSecret);
  }

  async function beginCardSetup() {
    if (!isAuthenticated) {
      setAccessPrompt('signin');
      return;
    }
    setError('');
    setNotice('');
    const result = await prepareWorkspaceCardUpdate();
    if (result.error) setError(result.error);
    else setSetupSecret(result.clientSecret);
  }

  const dateTime = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="workspace-app">
      <aside className="workspace-sidebar">
        <Link className="workspace-brand" href="/" aria-label="One Fin Solution homepage">
          <span className="workspace-brand-mark"><Sparkles size={17} /></span>
          <span>One Fin <small>WORKSPACE</small></span>
        </Link>
        <p className="workspace-sidebar-label">WORKSPACE</p>
        <a className="workspace-side-link is-active" href="#workspace-home"><LayoutGrid size={17} />Overview</a>
        <a className="workspace-side-link" href="#workspace-credits"><Wallet size={17} />Credits &amp; usage</a>
        <a className="workspace-side-link" href="#workspace-payments"><CreditCard size={17} />Payment settings</a>
        <a className="workspace-side-link" href="#workspace-transactions"><History size={17} />Transactions</a>
        <a className="workspace-side-link" href="#workspace-activity"><FileText size={17} />Activity</a>
        <div className="workspace-sidebar-spacer" />
        <Link className="workspace-side-link" href={isAuthenticated ? '/account' : '/sign-in?next=%2Fworkspace'}><Settings size={17} />Account settings</Link>
        {isAuthenticated && email
          ? <div className="workspace-user">
              <span className="workspace-user-avatar">{email.slice(0, 1).toUpperCase()}</span>
              <span><strong>{email}</strong><small>Workspace account</small></span>
            </div>
          : <Link className="workspace-side-link" href="/sign-in?next=%2Fworkspace">Sign in to your Workspace</Link>}
      </aside>

      <main className="workspace-main" id="workspace-home">
        <header className="workspace-topbar">
          <div><span className="workspace-breadcrumb">One Fin /</span> Workspace</div>
          <div className="workspace-top-actions">
            {isAuthenticated && <Link href="/dashboard/billing">Subscription billing</Link>}
            <span className="workspace-mode-badge">Credit balance · {loading ? '…' : balance ?? (isAuthenticated ? 'Unavailable' : 'Sign in required')}</span>
          </div>
        </header>

        <div className="workspace-content">
          <section className="workspace-welcome">
            <div>
              <p className="workspace-eyebrow">YOUR WORKSPACE</p>
              <h1>Build something useful.</h1>
              <p>Work through a task with One Fin AI. Completed tasks use credits from your Workspace balance.</p>
            </div>
            <button className="workspace-secondary-button" type="button" onClick={() => { setMessages([]); setPrompt(''); setError(''); setNotice(''); }}>
              <Plus size={16} /> New task
            </button>
          </section>

          {(error || notice) && (
            <div className={error ? 'workspace-alert' : 'workspace-notice'} role={error ? 'alert' : 'status'}>
              {error || notice}
            </div>
          )}

          <section className="workspace-metrics" id="workspace-credits" aria-label="Workspace credits">
            <article className="workspace-metric-card workspace-balance-card">
              <span className="workspace-metric-label">AVAILABLE WORKSPACE CREDITS</span>
              <strong>{loading ? '…' : balance ?? (isAuthenticated ? '—' : 'Sign in')}</strong>
              <span className="workspace-muted-copy">{'creditCost' in data ? `${data.creditCost} credit${data.creditCost === 1 ? '' : 's'} used when a task completes successfully.` : isAuthenticated ? 'Credit pricing is temporarily unavailable.' : 'Sign in to view your balance and Workspace credit usage.'}</span>
              <button className="workspace-primary-button" type="button" onClick={() => void beginPurchase()} disabled={isAuthenticated && !publishableKey}>
                <Plus size={16} /> {isAuthenticated ? 'Add 50 credits · $5' : 'Sign in to add credits'}
              </button>
              {isAuthenticated && !publishableKey && <span className="workspace-muted-copy">Credit checkout is not configured yet.</span>}
            </article>
            <article className="workspace-metric-card">
              <span className="workspace-metric-label">COMPLETED TASKS</span>
              <strong>{loading ? '…' : usage.filter((item) => item.status === 'completed').length}</strong>
              <span className="workspace-muted-copy">Your recent credit-consuming operations.</span>
            </article>
            <article className="workspace-metric-card">
              <span className="workspace-metric-label">PAYMENT METHOD</span>
              <strong className="workspace-card-value">{card?.card_last4 ? `•••• ${card.card_last4}` : isAuthenticated ? 'Not added' : 'Sign in required'}</strong>
              <span className="workspace-muted-copy">{card?.card_brand ? `${card.card_brand} · Expires ${card.card_exp_month}/${card.card_exp_year}` : 'Cards are used only for one-time Workspace purchases.'}</span>
              <button className="workspace-link-button" type="button" onClick={() => void beginCardSetup()} disabled={isAuthenticated && !publishableKey}>Manage payment method</button>
            </article>
          </section>

          {(paymentSecret || setupSecret) && stripePromise && (
            <section className="workspace-panel workspace-checkout-panel" aria-label={paymentSecret ? 'Add Workspace credits' : 'Save Workspace payment method'}>
              <div className="workspace-panel-heading">
                <div><p className="workspace-eyebrow">{paymentSecret ? 'ONE-TIME PURCHASE' : 'PAYMENT SETTINGS'}</p><h2>{paymentSecret ? 'Add credits to your balance' : 'Save a payment method'}</h2></div>
                <button className="workspace-link-button" type="button" onClick={() => { setPaymentSecret(''); setSetupSecret(''); }}>Cancel</button>
              </div>
              <Elements stripe={stripePromise} options={{ clientSecret: paymentSecret || setupSecret }} key={paymentSecret || setupSecret}>
                {paymentSecret
                  ? <WorkspacePaymentForm purchaseId={purchaseId} onComplete={() => { setPaymentSecret(''); setNotice('50 Workspace credits were added to your balance.'); void refreshData(); }} initialData={data} />
                  : <WorkspaceCardForm onComplete={() => { setSetupSecret(''); setNotice('Workspace payment method saved.'); void refreshData(); }} />}
              </Elements>
            </section>
          )}

          <section className="workspace-panel workspace-task-panel" aria-label="Workspace AI task">
            <div className="workspace-panel-heading">
              <div><p className="workspace-eyebrow">TASK STUDIO</p><h2>What are you working on?</h2></div>
              <span className="workspace-task-cost">{'creditCost' in data ? data.creditCost : '—'} credit{'creditCost' in data && data.creditCost === 1 ? '' : 's'} per completed response</span>
            </div>
            {messages.length > 0 && (
              <div className="workspace-task-messages" role="log" aria-live="polite">
                {messages.map((message, index) => (
                  <article key={`${index}-${message.sender}`} className={`workspace-task-message is-${message.sender}`}>
                    <strong>{message.sender === 'user' ? 'You' : 'One Fin AI'}</strong><p>{message.content}</p>
                  </article>
                ))}
                {busy && <p className="workspace-task-pending" role="status">Working on your task…</p>}
              </div>
            )}
            <form className="workspace-task-form" onSubmit={sendTask}>
              <label className="sr-only" htmlFor="workspace-task-prompt">Describe a Workspace task</label>
              <textarea
                id="workspace-task-prompt"
                rows={4}
                maxLength={4000}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the task you want to work on…"
                disabled={busy}
              />
              <div className="workspace-task-form-footer">
                <span>{prompt.length}/4000 characters · Shift + Enter for a new line</span>
                <button className="workspace-primary-button" type="submit" disabled={busy || !prompt.trim()}>
                  {busy ? 'Working…' : isAuthenticated ? 'Run task' : 'Sign in to run'} <ArrowUp size={16} />
                </button>
              </div>
            </form>
            {!loading && isAuthenticated && balance === 0 && (
              <div className="workspace-empty-credits">
                <strong>You’re out of Workspace credits.</strong>
                <span>Add a one-time credit pack to continue. Chat subscriptions do not include Workspace credits.</span>
                <button className="workspace-link-button" type="button" onClick={() => setAccessPrompt('credits')}>Add credits</button>
              </div>
            )}
            {!loading && !isAuthenticated && (
              <div className="workspace-empty-credits">
                <strong>Sign in when you’re ready to use Workspace.</strong>
                <span>Your credits, payment methods, transactions, and task history stay with your account.</span>
                <button className="workspace-link-button" type="button" onClick={() => setAccessPrompt('signin')}>Sign in to continue</button>
              </div>
            )}
          </section>

          <section className="workspace-two-panels">
            <article className="workspace-panel" id="workspace-transactions">
              <div className="workspace-panel-heading"><div><p className="workspace-eyebrow">PAYMENTS</p><h2>Credit purchases</h2></div><span className="workspace-muted-copy">One-time purchases only</span></div>
              {transactions.length ? (
                <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>Date</th><th>Credits</th><th>Amount</th><th>Status</th></tr></thead><tbody>
                  {transactions.map((item) => <tr key={item.id}><td>{dateTime(item.created_at)}</td><td>+{item.credits}</td><td>{(item.amount / 100).toLocaleString(undefined, { style: 'currency', currency: item.currency.toUpperCase() })}</td><td><span className="workspace-status-pill">Paid</span></td></tr>)}
                </tbody></table></div>
              ) : <p className="workspace-empty-copy">{isAuthenticated ? 'Completed credit purchases will appear here.' : 'Sign in to view your private Workspace transactions.'}</p>}
              {isAuthenticated && <Link className="workspace-inline-link" href="/dashboard/billing">View subscription billing separately →</Link>}
            </article>
            <article className="workspace-panel" id="workspace-activity">
              <div className="workspace-panel-heading"><div><p className="workspace-eyebrow">USAGE</p><h2>Recent activity</h2></div><span className="workspace-muted-copy">Latest 20 operations</span></div>
              {usage.length ? (
                <ul className="workspace-activity-list">{usage.map((item) => <li key={item.id}><span><strong>Workspace AI task</strong><small>{dateTime(item.created_at)}</small></span><span className="workspace-status-pill">{item.status === 'completed' ? `−${item.credits} credit${item.credits === 1 ? '' : 's'}` : item.status}</span></li>)}</ul>
              ) : <p className="workspace-empty-copy">{isAuthenticated ? 'Your completed Workspace tasks will appear here.' : 'Sign in to view private task history.'}</p>}
            </article>
          </section>

          <section className="workspace-panel workspace-reload-panel">
            <div><p className="workspace-eyebrow">CREDIT RELOADS</p><h2>Automatic reloads are currently off</h2><p>One-time credit purchases are available now. Automatic and scheduled reloads will require separate confirmation, billing safeguards, and clear spending controls before being enabled.</p></div>
            <span className="workspace-status-pill">Not enabled</span>
          </section>
        </div>
      </main>
      {accessPrompt && (
        <div className="workspace-access-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setAccessPrompt(null); }}>
          <section className="workspace-access-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-access-title">
            <button className="workspace-access-close" type="button" aria-label="Close dialog" onClick={() => setAccessPrompt(null)}>×</button>
            {accessPrompt === 'signin' ? (
              <>
                <p className="workspace-eyebrow">WORKSPACE ACCESS</p>
                <h2 id="workspace-access-title">Sign in to continue</h2>
                <p>Sign in to verify your Workspace credits and start using credit-based tools. A homepage chat subscription does not include Workspace credits.</p>
                <div className="workspace-access-actions">
                  <Link className="workspace-primary-button" href="/sign-in?next=%2Fworkspace">Sign in</Link>
                  <Link className="workspace-link-button" href="/sign-up">Create account</Link>
                </div>
              </>
            ) : (
              <>
                <p className="workspace-eyebrow">WORKSPACE CREDITS</p>
                <h2 id="workspace-access-title">Add credits to continue</h2>
                <p>You need more Workspace credits to run this task. Add a one-time credit pack; it does not start a chat subscription.</p>
                <div className="workspace-access-actions">
                  <button className="workspace-primary-button" type="button" disabled={!publishableKey} onClick={() => { setAccessPrompt(null); void beginPurchase(); }}>
                    <Plus size={16} /> Add 50 credits · $5
                  </button>
                  {!publishableKey && <span className="workspace-muted-copy">Credit checkout is not configured yet.</span>}
                  <button className="workspace-link-button" type="button" onClick={() => setAccessPrompt(null)}>Not now</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
