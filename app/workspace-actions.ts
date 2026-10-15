'use server';

import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { currentUser } from '@/lib/session';
import { workspaceCustomer } from '@/lib/workspace-stripe';
import { verifiedStripe } from '@/lib/stripe';
import { query } from '@/lib/db';
import { ensureSignupCredits } from '@/lib/credits';
import { workspaceCreditCost } from '@/lib/credit-config';
import { workspaceCreditPack } from '@/lib/workspace-credit-pack';
import { creditPlans } from '@/lib/credit-config';
import { fulfillStripeEvent } from '@/lib/stripe-fulfillment';
import { throttle } from '@/lib/auth-service';
import { revalidatePath } from 'next/cache';
import { expectedStripeLivemode, stripeObjectMatchesMode } from '@/lib/billing-environment';
import {
  assertCustomerMatchesScope,
  assertSetupIntentOwnedByCustomer,
  requireOwnedPaymentMethod,
  stripeCustomerId as scopedStripeCustomerId,
  stripePaymentMethodId,
} from '@/lib/billing-scope';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stripeCustomerId = scopedStripeCustomerId;

export async function getWorkspaceBillingData() {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to open your Workspace.' } as const;
  try {
    await ensureSignupCredits(user.id);
    await query('select reconcile_credit_usage($1)', [user.id]);
    const [balance, usage, transactions, card] = await Promise.all([
      query<{ balance: string }>('select available_credits($1)::text as balance', [user.id]),
      query<{ id: string; status: string; created_at: string }>(
        'select id,status,created_at::text from credit_usage where user_id=$1 order by created_at desc limit 20',
        [user.id],
      ),
      query<{ id: string; amount: number; currency: string; credits: number; created_at: string }>(
        'select id,amount,currency,credits,created_at::text from workspace_credit_transactions where user_id=$1 order by created_at desc limit 20',
        [user.id],
      ),
      query<{ card_brand: string | null; card_last4: string | null; card_exp_month: number | null; card_exp_year: number | null }>(
        'select card_brand,card_last4,card_exp_month,card_exp_year from workspace_credit_settings where user_id=$1',
        [user.id],
      ),
    ]);
    return {
      balance: Number(balance[0]?.balance || 0),
      creditCost: workspaceCreditCost(),
      usage: usage.map((item) => ({ ...item, credits: item.status === 'completed' ? workspaceCreditCost() : 0 })),
      transactions,
      card: card[0] || null,
    } as const;
  } catch (error) {
    console.error('Unable to load Workspace billing data:', error);
    return { error: 'Workspace billing data is temporarily unavailable.' } as const;
  }
}

export type WorkspaceSavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
};

async function saveWorkspaceCardSummary(userId: string, method: Stripe.PaymentMethod | null) {
  await query(
    `insert into workspace_credit_settings(
       user_id,payment_method_id,card_brand,card_last4,card_exp_month,card_exp_year,updated_at
     ) values($1,$2,$3,$4,$5,$6,now())
     on conflict(user_id) do update set payment_method_id=excluded.payment_method_id,
       card_brand=excluded.card_brand,card_last4=excluded.card_last4,
       card_exp_month=excluded.card_exp_month,card_exp_year=excluded.card_exp_year,updated_at=now()`,
    [
      userId,
      method?.id ?? null,
      method?.card?.brand ?? null,
      method?.card?.last4 ?? null,
      method?.card?.exp_month ?? null,
      method?.card?.exp_year ?? null,
    ],
  );
}

export async function listWorkspacePaymentMethods() {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to manage Workspace payment methods.' } as const;
  try {
    const customer = await workspaceCustomer(user.id);
    if (!customer) return { methods: [] as WorkspaceSavedPaymentMethod[] } as const;
    const stripe = await verifiedStripe();
    const customerRecord = await stripe.customers.retrieve(customer);
    assertCustomerMatchesScope(customerRecord, 'workspace', user.id);
    const defaultValue = customerRecord.invoice_settings?.default_payment_method;
    const defaultId = typeof defaultValue === 'string' ? defaultValue : defaultValue?.id || null;
    const methods: WorkspaceSavedPaymentMethod[] = [];
    for await (const method of stripe.paymentMethods.list({ customer, type: 'card', limit: 100 })) {
      methods.push({
        id: method.id,
        brand: method.card?.brand || 'card',
        last4: method.card?.last4 || 'â€¢â€¢â€¢â€¢',
        expMonth: method.card?.exp_month ?? null,
        expYear: method.card?.exp_year ?? null,
        isDefault: method.id === defaultId,
      });
    }
    methods.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    return { methods } as const;
  } catch (error) {
    console.error('Unable to load Workspace payment methods:', error);
    return { error: 'Workspace payment methods are temporarily unavailable.' } as const;
  }
}

export async function setWorkspaceDefaultPaymentMethod(paymentMethodId: string) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to manage Workspace payment methods.' } as const;
  if (!/^pm_[a-zA-Z0-9]+$/.test(paymentMethodId)) return { error: 'Invalid Workspace payment method.' } as const;
  try {
    const customer = await workspaceCustomer(user.id);
    if (!customer) return { error: 'No Workspace payment method is saved yet.' } as const;
    const stripe = await verifiedStripe();
    const method = await requireOwnedPaymentMethod(stripe, customer, paymentMethodId);
    await stripe.customers.update(customer, { invoice_settings: { default_payment_method: method.id } });
    await saveWorkspaceCardSummary(user.id, method);
    revalidatePath('/workspace');
    revalidatePath('/account');
    return { success: true, message: 'Workspace default payment method updated.' } as const;
  } catch (error) {
    console.error('Unable to update Workspace default payment method:', error);
    return { error: 'Unable to update the Workspace default card.' } as const;
  }
}

export async function removeWorkspacePaymentMethod(paymentMethodId: string) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to manage Workspace payment methods.' } as const;
  if (!/^pm_[a-zA-Z0-9]+$/.test(paymentMethodId)) return { error: 'Invalid Workspace payment method.' } as const;
  try {
    const customer = await workspaceCustomer(user.id);
    if (!customer) return { error: 'No Workspace payment method is saved yet.' } as const;
    const stripe = await verifiedStripe();
    const method = await requireOwnedPaymentMethod(stripe, customer, paymentMethodId);
    const customerRecord = await stripe.customers.retrieve(customer);
    if (customerRecord.deleted || !stripeObjectMatchesMode(customerRecord.livemode)) {
      return { error: 'That card is not saved in your Workspace.' } as const;
    }
    const defaultValue = customerRecord.invoice_settings?.default_payment_method;
    const defaultId = typeof defaultValue === 'string' ? defaultValue : defaultValue?.id || null;
    await stripe.paymentMethods.detach(method.id);
    const remaining = await stripe.paymentMethods.list({ customer, type: 'card', limit: 100 });
    const nextDefault = defaultId === method.id ? remaining.data[0] || null : null;
    if (defaultId === method.id) {
      await stripe.customers.update(customer, {
        invoice_settings: { default_payment_method: nextDefault?.id || '' },
      });
    }
    const summaryMethod = defaultId && defaultId !== method.id
      ? await stripe.paymentMethods.retrieve(defaultId)
      : nextDefault;
    if (summaryMethod && stripeCustomerId(summaryMethod.customer) !== customer) {
      throw new Error('Workspace default card is not attached to the billing customer.');
    }
    await saveWorkspaceCardSummary(user.id, summaryMethod);
    revalidatePath('/workspace');
    revalidatePath('/account');
    return { success: true, message: 'Workspace payment method removed.' } as const;
  } catch (error) {
    console.error('Unable to remove Workspace payment method:', error);
    return { error: 'Unable to remove the Workspace payment method.' } as const;
  }
}

export async function createWorkspaceCreditPaymentIntent(purchaseId: string) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to add Workspace credits.' } as const;
  if (!uuid.test(purchaseId)) return { error: 'Invalid credit purchase request.' } as const;

  try {
    await throttle(`workspace-credit-purchase:${user.id}`, 10);
    const customer = await workspaceCustomer(user.id, true);
    if (!customer) throw new Error('Unable to prepare the billing account.');
    const packPrices = Object.entries(creditPlans()).filter(([, plan]) =>
      plan.kind === 'pack' && plan.credits === workspaceCreditPack.credits,
    );
    if (packPrices.length !== 1) throw new Error('Workspace credit packs are not configured.');
    const [purchase] = await query<{
      id: string;
      user_id: string;
      stripe_payment_intent: string | null;
      status: 'pending' | 'succeeded' | 'failed';
    }>(
      `insert into workspace_credit_purchases(id,user_id,amount,credits,status)
       values($1,$2,$3,$4,'pending')
       on conflict(id) do update set id=excluded.id
       where workspace_credit_purchases.user_id=excluded.user_id
       returning id,user_id,stripe_payment_intent,status`,
      [purchaseId, user.id, workspaceCreditPack.amount, workspaceCreditPack.credits],
    );
    if (!purchase || purchase.status !== 'pending') return { error: 'This purchase request is no longer available.' } as const;

    const stripe = await verifiedStripe();
    const price = await stripe.prices.retrieve(packPrices[0][0], { expand: ['product'] });
    const product = price.product as Stripe.Product;
    if (!stripeObjectMatchesMode(price.livemode) || !price.active || price.currency !== workspaceCreditPack.currency ||
        price.unit_amount !== workspaceCreditPack.amount || price.recurring ||
        product.deleted || !product.active || product.metadata.app !== 'chatbot-template' ||
        price.metadata.app !== 'chatbot-template' ||
        Number(price.metadata.credits) !== workspaceCreditPack.credits) {
      throw new Error('The Workspace credit pack price does not match the verified catalog.');
    }
    let intent: Stripe.PaymentIntent;
    if (purchase.stripe_payment_intent) {
      intent = await stripe.paymentIntents.retrieve(purchase.stripe_payment_intent);
    } else {
      intent = await stripe.paymentIntents.create({
        amount: workspaceCreditPack.amount,
        currency: workspaceCreditPack.currency,
        customer,
        automatic_payment_methods: { enabled: true },
        setup_future_usage: 'off_session',
        description: `${workspaceCreditPack.credits} One Fin Workspace credits`,
        metadata: {
          app: 'chatbot-template',
          flow: 'workspace-credit-purchase',
          purchase_id: purchaseId,
          user_id: user.id,
          pack_id: workspaceCreditPack.id,
          price_id: price.id,
        },
      }, { idempotencyKey: `workspace-credit-purchase:${purchaseId}` });
      await query(
        `update workspace_credit_purchases set stripe_payment_intent=$1
         where id=$2 and user_id=$3 and status='pending'
           and (stripe_payment_intent is null or stripe_payment_intent=$1)`,
        [intent.id, purchaseId, user.id],
      );
    }
    if (!stripeObjectMatchesMode(intent.livemode) || intent.customer !== customer || intent.amount !== workspaceCreditPack.amount ||
        intent.currency !== workspaceCreditPack.currency || intent.metadata.purchase_id !== purchaseId ||
        intent.metadata.user_id !== user.id || intent.metadata.flow !== 'workspace-credit-purchase') {
      throw new Error('Credit purchase verification failed.');
    }
    if (!intent.client_secret) throw new Error('Unable to prepare secure card entry.');
    return { clientSecret: intent.client_secret } as const;
  } catch (error) {
    console.error('Unable to create Workspace credit payment:', error);
    return { error: error instanceof Error && error.message.includes('Too many')
      ? 'Too many purchase attempts. Please wait and try again.'
      : 'Unable to prepare your credit purchase. Please try again.' } as const;
  }
}

export async function workspaceCreditPurchaseStatus(purchaseId: string) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to view this purchase.' } as const;
  if (!uuid.test(purchaseId)) return { error: 'Invalid purchase reference.' } as const;
  try {
    const [purchase] = await query<{ stripe_payment_intent: string | null; status: string }>(
      'select stripe_payment_intent,status from workspace_credit_purchases where id=$1 and user_id=$2',
      [purchaseId, user.id],
    );
    if (!purchase) return { error: 'Purchase not found.' } as const;
    if (purchase.status === 'succeeded') return { status: 'succeeded' } as const;
    if (!purchase.stripe_payment_intent) return { status: 'pending' } as const;

    const stripe = await verifiedStripe();
    const intent = await stripe.paymentIntents.retrieve(purchase.stripe_payment_intent, { expand: ['payment_method'] });
    if (intent.metadata.purchase_id !== purchaseId || intent.metadata.user_id !== user.id ||
        intent.metadata.flow !== 'workspace-credit-purchase') {
      return { error: 'Purchase verification failed.' } as const;
    }
    if (intent.status === 'succeeded') {
      await fulfillStripeEvent(stripe, {
        id: `workspace-purchase-status:${intent.id}`,
        type: 'payment_intent.succeeded',
        livemode: expectedStripeLivemode(),
        data: { object: { id: intent.id } },
      } as Stripe.Event);
      revalidatePath('/workspace');
      return { status: 'succeeded' } as const;
    }
    if (intent.status === 'canceled') return { status: 'failed' } as const;
    return { status: 'pending' } as const;
  } catch (error) {
    console.error('Unable to verify Workspace credit purchase:', error);
    return { error: 'Unable to verify the payment yet. Please refresh and check your transactions.' } as const;
  }
}

export async function prepareWorkspaceCardUpdate() {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to manage Workspace payment settings.' } as const;
  try {
    await throttle(`workspace-payment-method:${user.id}`, 10);
    const customer = await workspaceCustomer(user.id, true);
    if (!customer) throw new Error('Billing account unavailable.');
    const stripe = await verifiedStripe();
    const setup = await stripe.setupIntents.create({
      customer,
      usage: 'off_session',
      allowed_payment_method_types: ['card'],
      metadata: { app: 'chatbot-template', flow: 'workspace-credit-card', user_id: user.id },
    }, { idempotencyKey: `workspace-card:${user.id}:${randomUUID()}` });
    if (!setup.client_secret) throw new Error('Card setup is unavailable.');
    return { clientSecret: setup.client_secret } as const;
  } catch (error) {
    console.error('Unable to prepare Workspace card setup:', error);
    return { error: 'Unable to prepare secure card setup. Please try again.' } as const;
  }
}

export async function saveWorkspaceCard(setupIntentId: string) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to manage Workspace payment settings.' } as const;
  if (!/^seti_[a-zA-Z0-9]+$/.test(setupIntentId)) return { error: 'Invalid card setup reference.' } as const;
  try {
    const customer = await workspaceCustomer(user.id);
    const stripe = await verifiedStripe();
    if (!customer) throw new Error('Card verification failed.');
    const setup = await stripe.setupIntents.retrieve(setupIntentId, { expand: ['payment_method'] });
    assertSetupIntentOwnedByCustomer(setup, customer);
    const metadata = setup.metadata || {};
    if (
      metadata.app !== 'chatbot-template' ||
      metadata.flow !== 'workspace-credit-card' ||
      metadata.user_id !== user.id
    ) {
      throw new Error('Card verification failed.');
    }
    const methodId = stripePaymentMethodId(setup.payment_method);
    if (!methodId) throw new Error('Card verification failed.');
    const method = await requireOwnedPaymentMethod(stripe, customer, methodId);
    if (method.type !== 'card' || !method.card) throw new Error('Card verification failed.');
    await query(
      `insert into workspace_credit_settings(user_id,payment_method_id,card_brand,card_last4,card_exp_month,card_exp_year,updated_at)
       values($1,$2,$3,$4,$5,$6,now())
       on conflict(user_id) do update set payment_method_id=excluded.payment_method_id,card_brand=excluded.card_brand,
         card_last4=excluded.card_last4,card_exp_month=excluded.card_exp_month,card_exp_year=excluded.card_exp_year,updated_at=now()`,
      [user.id, method.id, method.card.brand, method.card.last4, method.card.exp_month, method.card.exp_year],
    );
    await stripe.customers.update(customer, { invoice_settings: { default_payment_method: method.id } });
    revalidatePath('/workspace');
    revalidatePath('/account');
    return { success: true } as const;
  } catch (error) {
    console.error('Unable to save Workspace card:', error);
    return { error: 'Unable to verify and save this card. Please try again.' } as const;
  }
}
