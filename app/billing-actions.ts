'use server';
import { schedulePlanChange } from '@/lib/stripe-billing';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/session';
import { query } from '@/lib/db';
import { verifiedStripe } from '@/lib/stripe';
import { fulfillStripeEvent } from '@/lib/stripe-fulfillment';
import type Stripe from 'stripe';

export async function changePlanAction(priceId: string): Promise<{ success: boolean; error?: string; date?: string }> {
  if (process.env.BILLING_PROVIDER !== 'stripe') return { success: false, error: 'Plan changes are unavailable with this billing provider.' };
  try {
    const date = await schedulePlanChange(priceId);
    revalidatePath('/account');
    revalidatePath('/pricing');
    revalidatePath('/dashboard/billing');
    return { success: true, date };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to change plan.' };
  }
}

export async function checkoutStatusAction(sessionId: string): Promise<'paid' | 'pending'> {
  if (process.env.BILLING_PROVIDER !== 'stripe' || !/^cs_test_[a-zA-Z0-9]+$/.test(sessionId)) throw new Error('Invalid checkout.');
  const user=await currentUser();
  if (!user) throw new Error('Please sign in.');
  const [mapping]=await query('select customer_id from billing_customers where user_id=$1',[user.id]);
  if (!mapping) throw new Error('Billing account unavailable.');
  const stripe = await verifiedStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.livemode || session.customer !== mapping.customer_id || session.metadata?.app !== 'chatbot-template') throw new Error('Checkout not found.');
  if (session.status !== 'complete' || !['paid','no_payment_required'].includes(session.payment_status)) return 'pending';
  if (session.mode === 'payment') {
    await fulfillStripeEvent(stripe,{ type:'checkout.session.completed',livemode:false,data:{object:{id:session.id}} } as Stripe.Event);
  } else {
    const invoice = typeof session.invoice === 'string' ? session.invoice : session.invoice?.id;
    if (!invoice) return 'pending';
    await fulfillStripeEvent(stripe,{ type:'invoice.paid',livemode:false,data:{object:{id:invoice}} } as Stripe.Event);
  }
  revalidatePath('/account');
  return 'paid';
}
