'use client';

import { useState, useTransition } from 'react';
import { createSoftwareCheckout } from './actions';

export function CheckoutForm({
  kind,
  id,
  fullPrice,
}: {
  kind: 'template' | 'software';
  id: string;
  fullPrice: number;
}) {
  const [amount, setAmount] = useState(fullPrice.toFixed(2));
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createSoftwareCheckout(formData);
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setError(result.error || 'Checkout could not be started. Please try again.');
    });
  }

  return (
    <form className="software-checkout-form" onSubmit={submit}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <label htmlFor="software-payment-amount">Choose your payment amount (USD)</label>
      <div className="software-checkout-amount">
        <span aria-hidden="true">$</span>
        <input
          id="software-payment-amount"
          name="amount"
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
      <p id="software-payment-hint">
        Minimum $5.00. Full listed price: ${fullPrice.toFixed(2)} USD.
      </p>
      {error && <p className="software-checkout-error" role="alert">{error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Opening secure checkout…' : 'Continue to secure checkout'}
      </button>
      <small>Secure one-time payment powered by Stripe. Any remaining scope or balance will be confirmed by our team.</small>
    </form>
  );
}
