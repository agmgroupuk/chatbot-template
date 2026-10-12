'use server';

import { verifiedStripe } from '@/lib/stripe';
import { getSoftwarePurchaseItem, parseSoftwarePaymentAmount } from '@/lib/software-purchase';
import { sitePath } from '@/lib/site-url';

export async function createSoftwareCheckout(formData: FormData): Promise<{ url?: string; error?: string }> {
  const kind = formData.get('kind');
  const id = formData.get('id');
  const amount = formData.get('amount');
  const item = getSoftwarePurchaseItem(
    typeof kind === 'string' ? kind : undefined,
    typeof id === 'string' ? id : undefined,
  );
  if (!item) return { error: 'That product could not be found. Return to the software catalog and try again.' };
  if (typeof amount !== 'string') return { error: 'Enter a payment amount in USD.' };

  const amountCents = parseSoftwarePaymentAmount(amount, item.priceCents);
  if (amountCents === null) {
    return { error: `Enter an amount from $5.00 to $${(item.priceCents / 100).toFixed(2)} USD.` };
  }

  try {
    const stripe = await verifiedStripe();
    const metadata = {
      app: 'onefin-software-store',
      flow: 'template-purchase',
      item_kind: item.kind,
      item_id: item.id,
      full_price_cents: String(item.priceCents),
    };
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_creation: 'always',
      billing_address_collection: 'auto',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: item.name,
            description: `Payment toward the listed ${item.kind} price of $${(item.priceCents / 100).toFixed(2)} USD.`,
          },
        },
      }],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${sitePath('/software/checkout/complete')}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${sitePath(`/software/checkout?kind=${item.kind}&id=${encodeURIComponent(item.id)}&cancelled=1`)}`,
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return { url: session.url };
  } catch (error) {
    console.error('Software storefront checkout could not be created.', error instanceof Error ? error.message : 'Unknown error.');
    return { error: 'Checkout is temporarily unavailable. Please try again later or contact our team.' };
  }
}
