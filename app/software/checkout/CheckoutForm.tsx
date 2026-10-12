'use client';

import { useMemo, useState, useTransition } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { createSoftwarePaymentIntent, softwarePurchaseStatus } from './actions';

function PaymentForm({ purchaseId, onCancel }: { purchaseId: string; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [busy, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setError('');
    startTransition(async () => {
      try {
        const { error: submitError } = await elements.submit();
        if (submitError) throw new Error(submitError.message || 'Check your payment details.');
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/software/checkout/complete?purchase_id=${encodeURIComponent(purchaseId)}`,
          },
          redirect: 'if_required',
        });
        if (result.error) throw new Error(result.error.message || 'Payment could not be completed.');
        if (result.paymentIntent?.status === 'succeeded' || result.paymentIntent?.status === 'processing') {
          const verified = await softwarePurchaseStatus(purchaseId);
          if (verified.error) throw new Error(verified.error);
          window.location.assign(`/software/checkout/complete?purchase_id=${encodeURIComponent(purchaseId)}`);
          return;
        }
        throw new Error('Payment has not been confirmed. Please try again.');
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Unable to complete this payment.');
      }
    });
  }

  return (
    <form className="software-checkout-form" onSubmit={submit}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className="software-checkout-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy || !stripe}>
        {busy ? 'Confirming payment…' : 'Pay securely'}
      </button>
      <button type="button" className="software-checkout-cancel" disabled={busy} onClick={onCancel}>
        Change amount or cancel
      </button>
    </form>
  );
}

export function CheckoutForm({
  kind,
  id,
  fullPrice,
  publishableKey,
}: {
  kind: 'template' | 'software';
  id: string;
  fullPrice: number;
  publishableKey: string;
}) {
  const [amount, setAmount] = useState(fullPrice.toFixed(2));
  const [error, setError] = useState('');
  const [payment, setPayment] = useState<{ clientSecret: string; purchaseId: string } | null>(null);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [isPending, startTransition] = useTransition();
  const stripePromise = useMemo(() => publishableKey ? loadStripe(publishableKey) : Promise.resolve(null), [publishableKey]);

  function startCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const purchaseId = crypto.randomUUID();
    startTransition(async () => {
      const result = await createSoftwarePaymentIntent({ kind, id, amount, purchaseId, savePaymentMethod });
      if (result.clientSecret) {
        setPayment({ clientSecret: result.clientSecret, purchaseId });
        return;
      }
      setError(result.error || 'Unable to prepare secure checkout. Please try again.');
    });
  }

  if (payment) {
    return (
      <div className="software-checkout-payment">
        <p className="software-checkout-secure-note">Secure card entry · Your Software payment profile only</p>
        <Elements stripe={stripePromise} options={{ clientSecret: payment.clientSecret, appearance: { theme: 'stripe' } }}>
          <PaymentForm purchaseId={payment.purchaseId} onCancel={() => setPayment(null)} />
        </Elements>
      </div>
    );
  }

  if (!publishableKey) {
    return <p className="software-checkout-error" role="alert">Secure payment is temporarily unavailable. Please contact our team.</p>;
  }

  return (
    <form className="software-checkout-form" onSubmit={startCheckout}>
      <label htmlFor="software-payment-amount">Choose your payment amount (USD)</label>
      <div className="software-checkout-amount">
        <span aria-hidden="true">$</span>
        <input
          id="software-payment-amount"
          type="number"
          min="5"
          max={fullPrice}
          step="0.01"
          inputMode="decimal"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-describedby="software-payment-hint"
        />
        <span>USD</span>
      </div>
      <p id="software-payment-hint">Minimum $5.00. Full listed price: ${fullPrice.toFixed(2)} USD.</p>
      <label className="software-checkout-save-card">
        <input
          type="checkbox"
          checked={savePaymentMethod}
          onChange={(event) => setSavePaymentMethod(event.target.checked)}
        />
        Save this card to my separate Software account for future Software payments.
      </label>
      {error && <p className="software-checkout-error" role="alert">{error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Preparing secure payment…' : 'Continue to secure payment'}
      </button>
      <small>Payment is collected securely here. Subscription and Workspace payment details are not used.</small>
    </form>
  );
}
