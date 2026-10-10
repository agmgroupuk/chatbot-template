'use client';

import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import {
  createWorkspaceCreditPaymentIntent,
  prepareWorkspaceCardUpdate,
  workspaceCreditPurchaseStatus,
} from '@/app/workspace-actions';
import { publicSitePath } from '@/lib/site-url';

function CreditPaymentForm({
  purchaseId,
  clientSecret,
}: {
  purchaseId: string;
  clientSecret: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const successUrl = publicSitePath(`/workspace?purchase=${encodeURIComponent(purchaseId)}&billing=success`);
  const failedUrl = '/workspace?billing=failed';
  const cancelledUrl = '/workspace?billing=cancelled';

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    try {
      const existing = await stripe.retrievePaymentIntent(clientSecret);
      if (existing.paymentIntent?.status === 'succeeded') {
        await workspaceCreditPurchaseStatus(purchaseId);
        location.assign(successUrl);
        return;
      }
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: successUrl },
        redirect: 'if_required',
      });
      if (result.error) {
        setError(result.error.message || 'Payment failed.');
        return;
      }
      if (result.paymentIntent?.status === 'succeeded') {
        await workspaceCreditPurchaseStatus(purchaseId);
        location.assign(successUrl);
        return;
      }
      location.assign(failedUrl);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to complete payment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <PaymentElement />
      {error ? (
        <p role="alert" className="notice error">
          {error}
        </p>
      ) : null}
      <button className="button" disabled={!stripe || busy} type="submit">
        {busy ? 'Processing…' : 'Pay and add 50 credits'}
      </button>
      <p>
        <a className="text-link" href={cancelledUrl}>
          Cancel and return to Workspace
        </a>
      </p>
    </form>
  );
}

function CardSetupForm({ clientSecret }: { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const successUrl = publicSitePath('/workspace?billing=card_saved');
  const cancelledUrl = '/workspace?billing=cancelled';

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: successUrl },
        redirect: 'if_required',
      });
      if (result.error) {
        setError(result.error.message || 'Unable to save card.');
        return;
      }
      location.assign(successUrl);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save card.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <PaymentElement />
      {error ? (
        <p role="alert" className="notice error">
          {error}
        </p>
      ) : null}
      <button className="button" disabled={!stripe || busy} type="submit">
        {busy ? 'Saving…' : 'Save card for Workspace'}
      </button>
      <p>
        <a className="text-link" href={cancelledUrl}>
          Cancel and return to Workspace
        </a>
      </p>
    </form>
  );
}

export function WorkspaceCreditCheckout({
  mode,
  publishableKey,
}: {
  mode: 'credits' | 'card';
  publishableKey: string;
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [payment, setPayment] = useState<{ purchaseId: string; clientSecret: string } | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const cancelledUrl = '/workspace?billing=cancelled';

  async function startCredits() {
    setBusy(true);
    setError('');
    try {
      const purchaseId = crypto.randomUUID();
      const result = await createWorkspaceCreditPaymentIntent(purchaseId);
      if (result.error || !result.clientSecret) {
        throw new Error(result.error || 'Unable to start checkout.');
      }
      setPayment({ purchaseId, clientSecret: result.clientSecret });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to start checkout.');
    } finally {
      setBusy(false);
    }
  }

  async function startCard() {
    setBusy(true);
    setError('');
    try {
      const result = await prepareWorkspaceCardUpdate();
      if (result.error || !result.clientSecret) {
        throw new Error(result.error || 'Unable to start card setup.');
      }
      setSetupSecret(result.clientSecret);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to start card setup.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'credits' && payment) {
    return (
      <div className="stack">
        <Elements stripe={stripePromise} options={{ clientSecret: payment.clientSecret }}>
          <CreditPaymentForm purchaseId={payment.purchaseId} clientSecret={payment.clientSecret} />
        </Elements>
      </div>
    );
  }

  if (mode === 'card' && setupSecret) {
    return (
      <div className="stack">
        <Elements stripe={stripePromise} options={{ clientSecret: setupSecret }}>
          <CardSetupForm clientSecret={setupSecret} />
        </Elements>
      </div>
    );
  }

  return (
    <div className="stack">
      {error ? (
        <p role="alert" className="notice error">
          {error}
        </p>
      ) : null}
      <button
        className="button"
        type="button"
        disabled={busy}
        onClick={() => void (mode === 'credits' ? startCredits() : startCard())}
      >
        {busy
          ? 'Preparing secure checkout…'
          : mode === 'credits'
            ? 'Continue to secure credit checkout'
            : 'Continue to secure card setup'}
      </button>
      <p>
        <a className="text-link" href={cancelledUrl}>
          Cancel and return to Workspace
        </a>
      </p>
    </div>
  );
}
