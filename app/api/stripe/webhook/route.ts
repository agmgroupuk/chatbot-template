import { stripeClient, verifiedStripe } from '@/lib/stripe';
import { fulfillStripeEvent } from '@/lib/stripe-fulfillment';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return Response.json({ error: 'Webhook not configured.' }, { status: 503 });
  const signature = request.headers.get('stripe-signature');
  if (!signature) return Response.json({ error: 'Missing signature.' }, { status: 400 });
  const body = await request.text();
  if (body.length > 1048576) return Response.json({ error: 'Payload too large.' }, { status: 413 });
  let event: Stripe.Event;
  try { event = stripeClient().webhooks.constructEvent(body, signature, secret); }
  catch { return Response.json({ error: 'Invalid signature.' }, { status: 400 }); }
  if (event.livemode) return Response.json({ error: 'Live events are disabled.' }, { status: 400 });
  if (![
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.canceled',
    'invoice.paid',
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.trial_will_end',
  ].includes(event.type)) return Response.json({ received: true });
  try {
    await fulfillStripeEvent(await verifiedStripe(), event);
    return Response.json({ received: true });
  } catch {
    // A non-2xx response lets Stripe retry; grants are idempotent across deliveries.
    console.error('Stripe fulfillment failed', { eventId: event.id, type: event.type });
    return Response.json({ error: 'Fulfillment unavailable. Retry required.' }, { status: 503 });
  }
}
