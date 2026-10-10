'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { ArrowUp, ChevronLeft, ChevronRight, CreditCard, FileText, History, LayoutGrid, Plus, Settings, Wallet, UserRound } from 'lucide-react';
import { createWorkspaceCreditPaymentIntent, getWorkspaceBillingData, prepareWorkspaceCardUpdate, saveWorkspaceCard, workspaceCreditPurchaseStatus } from '@/app/workspace-actions';
import { ConversationTools, exportConversation } from './conversation-tools';
import { MessageContent } from './message-content';
import { getMessagesForChat } from '@/app/actions';
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
type WorkspaceMessage = { id?: string; sender: 'user' | 'ai'; content: string };

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
  const [conversationId, setConversationId] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => {
    let active=true;const saved=new URLSearchParams(window.location.search).get('task');
    if(saved && /^[0-9a-f-]{36}$/i.test(saved) && isAuthenticated){setHistoryLoading(true);void getMessagesForChat(saved).then(items=>{if(active){setMessages(items);setConversationId(saved);}}).catch(()=>{if(active)setError('Unable to reopen task.');}).finally(()=>{if(active)setHistoryLoading(false);});}
    else setConversationId(crypto.randomUUID());
    return()=>{active=false;};
  }, [isAuthenticated]);
  async function openTask(id: string) {
    if(busy) return;
    setHistoryLoading(true);setError('');
    try {const saved=await getMessagesForChat(id);setMessages(saved);setConversationId(id);setPrompt('');setTaskAttachments([]);window.history.replaceState(null,'',`/workspace?task=${id}`);}catch{setError('Unable to reopen task.');}finally{setHistoryLoading(false);}
  }
  const [prompt, setPrompt] = useState('');
  const [taskAttachments,setTaskAttachments]=useState<{name:string;content:string}[]>([]);
  const [readingFiles,setReadingFiles]=useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [paymentSecret, setPaymentSecret] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [purchaseId, setPurchaseId] = useState('');
  const [accessPrompt, setAccessPrompt] = useState<'signin' | 'credits' | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  useEffect(()=>{
    const deleted=(event:Event)=>{if((event as CustomEvent<string>).detail===conversationId){setMessages([]);setPrompt('');setTaskAttachments([]);setConversationId(crypto.randomUUID());window.history.replaceState(null,'','/workspace');}};
    window.addEventListener('conversation-deleted',deleted);return()=>window.removeEventListener('conversation-deleted',deleted);
  },[conversationId]);
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

  useEffect(() => {
    const syncSidebarToViewport = () => {
      const isSmallScreen = window.matchMedia('(max-width: 720px)').matches;
      setIsSidebarCollapsed(isSmallScreen);
      setIsMobileSidebarOpen(false);
    };
    syncSidebarToViewport();
    window.addEventListener('resize', syncSidebarToViewport);
    return () => window.removeEventListener('resize', syncSidebarToViewport);
  }, []);

  async function sendTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = [prompt.trim(),...taskAttachments.map(file=>`Attached file: ${file.name}\n${file.content}`)].filter(Boolean).join('\n\n');
    if(text.length>24000){setError('Keep your prompt and attached text below 24,000 characters.');return;}
    if (!text || busy || historyLoading || !conversationId || readingFiles) return;
    if (!isAuthenticated) {
      setAccessPrompt('signin');
      return;
    }
    if (balance !== null && 'creditCost' in data && balance < data.creditCost) {
      setAccessPrompt('credits');
      return;
    }
    const optimistic = [...messages, { sender: 'user' as const, content: text }].slice(-19);
    const requestMessages = optimistic.map((message) => ({ ...message, content: message.content.slice(0, 32000) }));
    while (requestMessages.length > 1 && requestMessages.reduce((total, message) => total + message.content.length, 0) > 100000) {
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
        body: JSON.stringify({ messages: requestMessages, conversationId }),
      });
      const result = await response.json() as { answer?: string; answerId?: string; userMessageId?: string; balance?: number; error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to complete this Workspace task.');
      const answer = result.answer;
      const nextBalance = result.balance;
      if (typeof answer !== 'string' || typeof nextBalance !== 'number') throw new Error('The Workspace returned an invalid response.');
      setMessages([...optimistic.slice(0,-1),{...optimistic.at(-1)!,id:result.userMessageId}, { id:result.answerId, sender: 'ai', content: answer }]);
      setHistoryVersion(v=>v+1);
      window.history.replaceState(null,'',`/workspace?task=${conversationId}`);
      setPrompt('');setTaskAttachments([]);
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
  const toggleSidebar = () => {
    if (window.matchMedia('(max-width: 720px)').matches) setIsMobileSidebarOpen((open) => !open);
    else setIsSidebarCollapsed((collapsed) => !collapsed);
  };

  return (
    <div className={`workspace-app${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}${isMobileSidebarOpen ? ' is-mobile-sidebar-open' : ''}`}>
      {isMobileSidebarOpen && <button className="workspace-sidebar-backdrop" type="button" aria-label="Close Workspace navigation" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`workspace-sidebar${isSidebarCollapsed ? ' is-collapsed' : ''}${isMobileSidebarOpen ? ' is-mobile-expanded' : ''}`} aria-label="Workspace navigation">
        <div className="workspace-brand-row">
          <Link className="workspace-brand" href="/" aria-label="One Fin Solution homepage">
            <Image className="workspace-brand-mark" src="/logo/one-fin-logo.png" alt="" width={44} height={44} />
            <span>One Fin <small>WORKSPACE</small></span>
          </Link>
          <button className="workspace-sidebar-toggle" type="button" onClick={toggleSidebar} aria-label={isMobileSidebarOpen ? 'Close Workspace navigation' : isSidebarCollapsed ? 'Expand Workspace navigation' : 'Collapse Workspace navigation'} title={isMobileSidebarOpen ? 'Close navigation' : isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>
            {isMobileSidebarOpen ? <ChevronLeft size={18} /> : isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <p className="workspace-sidebar-label">WORKSPACE</p>
        <a className="workspace-side-link is-active" href="#workspace-home" aria-label="Overview" title="Overview"><LayoutGrid size={18} /><span>Overview</span></a>
        <a className="workspace-side-link" href="#workspace-credits" aria-label="Credits and usage" title="Credits and usage"><Wallet size={18} /><span>Credits &amp; usage</span></a>
        <a className="workspace-side-link" href="#workspace-payments" aria-label="Payment settings" title="Payment settings"><CreditCard size={18} /><span>Payment settings</span></a>
        <a className="workspace-side-link" href="#workspace-transactions" aria-label="Transactions" title="Transactions"><History size={18} /><span>Transactions</span></a>
        <a className="workspace-side-link" href="#workspace-activity" aria-label="Activity" title="Activity"><FileText size={18} /><span>Activity</span></a>
        <div className="workspace-sidebar-spacer" />
        <Link className="workspace-side-link" href={isAuthenticated ? '/account' : '/sign-in?next=%2Fworkspace'} aria-label="Account settings" title="Account settings"><Settings size={18} /><span>Account settings</span></Link>
        {isAuthenticated && email
          ? <div className="workspace-user">
              <span className="workspace-user-avatar" aria-hidden="true"><UserRound size={18} /></span>
              <span className="workspace-user-copy"><strong>{email}</strong><small>Workspace account</small></span>
            </div>
          : <Link className="workspace-side-link" href="/sign-in?next=%2Fworkspace" aria-label="Sign in to Workspace" title="Sign in to Workspace"><UserRound size={18} /><span>Sign in to your Workspace</span></Link>}
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
            <button className="workspace-secondary-button" type="button" disabled={busy || historyLoading} onClick={() => { setConversationId(crypto.randomUUID());setMessages([]);setPrompt('');setTaskAttachments([]);setError('');setNotice('');window.history.replaceState(null,'','/workspace'); }}>
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
            <article className="workspace-metric-card" id="workspace-payments">
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

          {isAuthenticated && <section className="workspace-panel"><h2>Saved tasks and projects</h2><ConversationTools area="workspace" onOpen={id=>void openTask(id)} refreshKey={historyVersion}/></section>}
          <section className="workspace-panel workspace-task-panel" aria-label="Workspace AI task">
            <div className="workspace-panel-heading">
              <div><p className="workspace-eyebrow">TASK STUDIO</p><h2>What are you working on?</h2></div>
              <span className="workspace-task-cost">{'creditCost' in data ? data.creditCost : '—'} credit{'creditCost' in data && data.creditCost === 1 ? '' : 's'} per completed response</span>
            </div>
            <div className="conversation-toolbar"><button type="button" disabled={!messages.length || busy} onClick={()=>exportConversation(messages)}>Export Markdown</button><button type="button" disabled={!messages.length || busy} onClick={()=>exportConversation(messages,'json')}>Export JSON</button></div>
            {historyLoading && <p role="status">Loading saved task?</p>}
            {messages.length > 0 && (
              <div className="workspace-task-messages" role="log" aria-live="polite">
                {messages.map((message, index) => (
                  <article key={`${index}-${message.sender}`} className={`workspace-task-message is-${message.sender}`}>
                    <strong>{message.sender === 'user' ? 'You' : 'One Fin AI'}</strong><MessageContent content={message.content}/><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(message.content);setNotice('Message copied.');}catch{setError('Unable to copy message.');}}}>Copy</button>
                  </article>
                ))}
                {busy && <p className="workspace-task-pending" role="status">Working on your task…</p>}
              </div>
            )}
            <div className="conversation-toolbar"><label>Attach text, Markdown, CSV or code<input type="file" multiple disabled={busy || readingFiles || historyLoading} accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.py,.sql,.css,.html,.yaml,.yml" onChange={async event=>{
              const files=Array.from(event.target.files||[]);event.target.value='';setReadingFiles(true);setError('');
              try{const additions:{name:string;content:string}[]=[];let total=taskAttachments.reduce((n,file)=>n+file.content.length,0);
                if(files.length+taskAttachments.length>5)throw new Error('Attach up to five text files.');
                for(const file of files){if(!/\.(txt|md|csv|json|js|ts|tsx|py|sql|css|html|yaml|yml)$/i.test(file.name)||file.size>100000)throw new Error('Use supported text files of 100 KB or smaller.');const content=await file.text();if(content.includes('\u0000'))throw new Error('Binary files are not supported.');total+=content.length;if(total>20000)throw new Error('Attached text must be under 20,000 characters.');additions.push({name:file.name,content});}
                setTaskAttachments(previous=>[...previous,...additions]);
              }catch(failure){setError(failure instanceof Error?failure.message:'Unable to read files.');}finally{setReadingFiles(false);}
            }}/></label>{readingFiles&&<span role="status">Reading files?</span>}{taskAttachments.map((file,index)=><button type="button" key={index} disabled={busy} onClick={()=>setTaskAttachments(items=>items.filter((_,i)=>i!==index))} aria-label={`Remove ${file.name}`}>{file.name} ?</button>)}</div>
            <form className="workspace-task-form" onSubmit={sendTask}>
              <label className="sr-only" htmlFor="workspace-task-prompt">Describe a Workspace task</label>
              <textarea
                id="workspace-task-prompt"
                rows={4}
                maxLength={4000}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the task you want to work on…"
                disabled={busy || historyLoading}
                onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}
              />
              <div className="workspace-task-form-footer">
                <span>{prompt.length}/4000 characters · Shift + Enter for a new line</span>
                <button className="workspace-primary-button" type="submit" disabled={busy || readingFiles || historyLoading || (!prompt.trim() && !taskAttachments.length)}>
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
