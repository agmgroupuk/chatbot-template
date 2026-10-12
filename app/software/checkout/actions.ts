'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import Stripe from 'stripe';
import { currentUser } from '@/lib/session';
import { query } from '@/lib/db';
import { throttle } from '@/lib/auth-service';
import { verifiedStripe } from '@/lib/stripe';
import { softwareCustomer } from '@/lib/software-stripe';
import { getSoftwarePurchaseItem, parseSoftwarePaymentAmount } from '@/lib/software-purchase';
import { stripeObjectMatchesMode } from '@/lib/billing-environment';
import { updateSoftwareBillingProfile as persistSoftwareBillingProfile, type SoftwareBillingProfile } from '@/lib/software-billing-profile';
import { syncSoftwareCustomerProfile } from '@/lib/software-stripe';
import { fulfillSoftwareStorefrontPayment } from '@/lib/software-storefront-fulfillment';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stripeId = (value: string | { id: string } | null) => typeof value === 'string' ? value : value?.id || null;

export async function createSoftwarePaymentIntent(input: {
  kind: string;
  id: string;
  amount: string;
  purchaseId: string;
  savePaymentMethod: boolean;
}): Promise<{ clientSecret?: string; error?: string }> {
  const user = await currentUser();
  if (!user) return { error: 'Sign in to continue to the software checkout.' };
  if (!input || typeof input !== 'object' ||
      typeof input.kind !== 'string' || typeof input.id !== 'string' ||
      typeof input.amount !== 'string' || typeof input.purchaseId !== 'string' ||
      typeof input.savePaymentMethod !== 'boolean' || !uuid.test(input.purchaseId)) {
    return { error: 'Invalid purchase request.' };
  }
  const item = getSoftwarePurchaseItem(input.kind, input.id);
  const amountCents = parseSoftwarePaymentAmount(input.amount, item?.priceCents ?? 0);
  if (!item || amountCents === null) return { error: 'Choose an amount from $5 up to the listed USD price.' };

  try {
    await throttle(`software-purchase:${user.id}`, 10);
    const customer = await softwareCustomer(user.id, true);
    if (!customer) throw new Error('Software billing account unavailable.');
    const stripe = await verifiedStripe();
    const [customerRecord] = await Promise.all([stripe.customers.retrieve(customer)]);
    if (customerRecord.deleted || !stripeObjectMatchesMode(customerRecord.livemode) ||
        customerRecord.metadata.app !== 'onefin-software-store' ||
        customerRecord.metadata.billing_scope !== 'software' ||
        customerRecord.metadata.user_id !== user.id) {
      throw new Error('Software billing customer verification failed.');
    }

    const [purchase] = await query<{
      id: string;
      stripe_payment_intent_id: string | null;
      status: 'pending' | 'paid' | 'failed';
    }>(
      `insert into software_storefront_purchases(
         id,user_id,item_kind,item_id,item_name,customer_email,amount_paid_cents,total_price_cents,currency,status
       ) values($1,$2,$3,$4,$5,$6,$7,$8,'usd','pending')
       on conflict(id) do update set id=excluded.id
       where software_storefront_purchases.user_id=excluded.user_id
         and software_storefront_purchases.item_id=excluded.item_id
         and software_storefront_purchases.amount_paid_cents=excluded.amount_paid_cents
       returning id,stripe_payment_intent_id,status`,
      [input.purchaseId, user.id, item.kind, item.id, item.name, user.email, amountCents, item.priceCents],
    );
    if (!purchase || purchase.status !== 'pending') return { error: 'This purchase request is no longer available.' };

    let intent: Stripe.PaymentIntent;
    if (purchase.stripe_payment_intent_id) {
      intent = await stripe.paymentIntents.retrieve(purchase.stripe_payment_intent_id);
    } else {
      intent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer,
        receipt_email: user.email,
        payment_method_types: ['card'],
        ...(input.savePaymentMethod ? { setup_future_usage: 'off_session' as const } : {}),
        description: `${item.name} software storefront payment`,
        metadata: {
          app: 'onefin-software-store',
          flow: 'storefront-purchase',
          billing_scope: 'software',
          user_id: user.id,
          purchase_id: input.purchaseId,
          item_kind: item.kind,
          item_id: item.id,
          full_price_cents: String(item.priceCents),
          save_payment_method: String(input.savePaymentMethod),
        },
      }, { idempotencyKey: `software-storefront-payment:${input.purchaseId}` });
      await query(
        `update software_storefront_purchases set stripe_payment_intent_id=$1
         where id=$2 and user_id=$3 and status='pending'
           and (stripe_payment_intent_id is null or stripe_payment_intent_id=$1)`,
        [intent.id, input.purchaseId, user.id],
      );
    }
    if (!stripeObjectMatchesMode(intent.livemode) || intent.customer !== customer ||
        intent.amount !== amountCents || intent.currency !== 'usd' ||
        intent.metadata.app !== 'onefin-software-store' ||
        intent.metadata.billing_scope !== 'software' ||
        intent.metadata.user_id !== user.id ||
        intent.metadata.purchase_id !== input.purchaseId ||
        intent.metadata.item_id !== item.id ||
        intent.metadata.save_payment_method !== String(input.savePaymentMethod) ||
        !intent.client_secret) {
      throw new Error('Software payment verification failed.');
    }
    return { clientSecret: intent.client_secret };
  } catch (error) {
    console.error('Unable to create software storefront payment:', error);
    return { error: error instanceof Error && error.message.includes('Too many')
      ? 'Too many checkout attempts. Please wait and try again.'
      : 'Unable to prepare secure checkout. Please try again.' };
  }
}

export async function softwarePurchaseStatus(purchaseId: string) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to verify this purchase.' } as const;
  if (!uuid.test(purchaseId)) return { error: 'Invalid purchase reference.' } as const;
  try {
    const [purchase] = await query<{
      stripe_payment_intent_id: string | null;
      status: 'pending' | 'paid' | 'failed';
    }>(
      'select stripe_payment_intent_id,status from software_storefront_purchases where id=$1 and user_id=$2',
      [purchaseId, user.id],
    );
    if (!purchase) return { error: 'Purchase not found.' } as const;
    if (purchase.status === 'paid') return { status: 'paid' } as const;
    if (purchase.status === 'failed') return { status: 'failed' } as const;
    if (!purchase.stripe_payment_intent_id) return { status: 'pending' } as const;
    const stripe = await verifiedStripe();
    const intent = await stripe.paymentIntents.retrieve(purchase.stripe_payment_intent_id);
    if (intent.metadata.app !== 'onefin-software-store' ||
        intent.metadata.billing_scope !== 'software' ||
        intent.metadata.user_id !== user.id ||
        intent.metadata.purchase_id !== purchaseId) {
      return { error: 'Purchase verification failed.' } as const;
    }
    if (intent.status === 'succeeded' || intent.status === 'canceled') {
      await fulfillSoftwareStorefrontPayment(stripe, {
        id: `software-purchase-status:${intent.id}`,
        type: intent.status === 'succeeded' ? 'payment_intent.succeeded' : 'payment_intent.canceled',
        livemode: intent.livemode,
        data: { object: { id: intent.id } },
      } as Stripe.Event);
      revalidatePath('/software/account');
      return { status: intent.status === 'succeeded' ? 'paid' : 'failed' } as const;
    }
    return { status: 'pending' } as const;
  } catch (error) {
    console.error('Unable to verify software storefront purchase:', error);
    const [updated] = await query<{ status: 'pending' | 'paid' | 'failed' }>(
      'select status from software_storefront_purchases where id=$1 and user_id=$2',
      [purchaseId, user.id],
    );
    if (updated?.status === 'paid') return { status: 'paid' } as const;
    return { error: 'Unable to verify this payment yet. Refresh the software account later.' } as const;
  }
}

export async function updateSoftwareBillingProfile(formData: FormData) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to update software billing details.' } as const;
  const fields = [
    'fullName', 'phone', 'companyName', 'billingName', 'billingLine1', 'billingLine2',
    'billingCity', 'billingState', 'billingPostal', 'billingCountry', 'shippingName',
    'shippingLine1', 'shippingLine2', 'shippingCity', 'shippingState', 'shippingPostal',
    'shippingCountry',
  ] as const;
  const values = Object.fromEntries(fields.map((field) => {
    const raw = formData.get(field);
    return [field, typeof raw === 'string' ? raw.trim() : ''];
  })) as Omit<SoftwareBillingProfile, 'shippingSameAsBilling'>;
  if (Object.values(values).some((value) => value.length > 160)) {
    return { error: 'Each billing detail must be 160 characters or fewer.' } as const;
  }
  for (const country of [values.billingCountry, values.shippingCountry]) {
    if (country && !/^[a-z]{2}$/i.test(country)) return { error: 'Enter a two-letter country code.' } as const;
  }
  const profile: SoftwareBillingProfile = {
    ...values,
    shippingSameAsBilling: formData.get('shippingSameAsBilling') === 'on',
  };
  try {
    await throttle(`software-profile:${user.id}`, 20);
    await persistSoftwareBillingProfile(user.id, profile);
    await syncSoftwareCustomerProfile(user.id, profile);
    revalidatePath('/software/account');
    return { success: true, message: 'Software billing details saved.' } as const;
  } catch (error) {
    console.error('Unable to save software billing profile:', error);
    return { error: 'Unable to save software billing details.' } as const;
  }
}

export async function listSoftwarePaymentMethods() {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to manage software payment methods.' } as const;
  try {
    const customer = await softwareCustomer(user.id);
    if (!customer) return { methods: [] as Array<{ id: string; brand: string; last4: string; expMonth: number; expYear: number; isDefault: boolean }> } as const;
    const stripe = await verifiedStripe();
    const record = await stripe.customers.retrieve(customer);
    if (record.deleted || !stripeObjectMatchesMode(record.livemode) ||
        record.metadata.app !== 'onefin-software-store' ||
        record.metadata.billing_scope !== 'software' ||
        record.metadata.user_id !== user.id) throw new Error('Software billing customer is unavailable.');
    const defaultValue = record.invoice_settings?.default_payment_method;
    const defaultId = typeof defaultValue === 'string' ? defaultValue : defaultValue?.id;
    const methods = [];
    for await (const method of stripe.paymentMethods.list({ customer, type: 'card', limit: 100 })) {
      methods.push({
        id: method.id,
        brand: method.card?.brand || 'card',
        last4: method.card?.last4 || '••••',
        expMonth: method.card?.exp_month || 0,
        expYear: method.card?.exp_year || 0,
        isDefault: method.id === defaultId,
      });
    }
    methods.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    return { methods } as const;
  } catch (error) {
    console.error('Unable to list software payment methods:', error);
    return { error: 'Software payment methods are temporarily unavailable.' } as const;
  }
}

export async function prepareSoftwareCardUpdate() {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to manage software payment methods.' } as const;
  try {
    await throttle(`software-payment-method:${user.id}`, 10);
    const customer = await softwareCustomer(user.id, true);
    if (!customer) throw new Error('Software billing account unavailable.');
    const stripe = await verifiedStripe();
    const setup = await stripe.setupIntents.create({
      customer,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { app: 'onefin-software-store', billing_scope: 'software', flow: 'software-card', user_id: user.id },
    }, { idempotencyKey: `software-card:${user.id}:${randomUUID()}` });
    if (!setup.client_secret || !stripeObjectMatchesMode(setup.livemode)) throw new Error('Software card setup unavailable.');
    return { clientSecret: setup.client_secret } as const;
  } catch (error) {
    console.error('Unable to prepare software payment method:', error);
    return { error: 'Unable to prepare secure card setup.' } as const;
  }
}

export async function saveSoftwareCard(setupIntentId: string) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to manage software payment methods.' } as const;
  if (!/^seti_[a-zA-Z0-9]+$/.test(setupIntentId)) return { error: 'Invalid card setup reference.' } as const;
  try {
    const customer = await softwareCustomer(user.id);
    const stripe = await verifiedStripe();
    const setup = await stripe.setupIntents.retrieve(setupIntentId, { expand: ['payment_method'] });
    const method = setup.payment_method;
    const setupMetadata = setup.metadata || {};
    if (!customer || !stripeObjectMatchesMode(setup.livemode) ||
        stripeId(setup.customer) !== customer || setup.status !== 'succeeded' ||
        setupMetadata.app !== 'onefin-software-store' ||
        setupMetadata.billing_scope !== 'software' ||
        setupMetadata.flow !== 'software-card' ||
        setupMetadata.user_id !== user.id ||
        !method || typeof method === 'string' || stripeId(method.customer) !== customer) throw new Error('Software card verification failed.');
    const savedMethod = method;
    if (!savedMethod || stripeId(savedMethod.customer) !== customer) throw new Error('Software card verification failed.');
    await stripe.customers.update(customer, { invoice_settings: { default_payment_method: savedMethod.id } });
    revalidatePath('/software/account');
    return { success: true } as const;
  } catch (error) {
    console.error('Unable to save software payment method:', error);
    return { error: 'Unable to verify and save this card.' } as const;
  }
}

export async function setSoftwareDefaultPaymentMethod(paymentMethodIdValue: string) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to manage software payment methods.' } as const;
  if (!/^pm_[a-zA-Z0-9]+$/.test(paymentMethodIdValue)) return { error: 'Invalid payment method.' } as const;
  try {
    const customer = await softwareCustomer(user.id);
    if (!customer) return { error: 'No software payment method is saved.' } as const;
    const stripe = await verifiedStripe();
    const [record, method] = await Promise.all([
      stripe.customers.retrieve(customer),
      stripe.paymentMethods.retrieve(paymentMethodIdValue),
    ]);
    if (record.deleted || !stripeObjectMatchesMode(record.livemode) ||
        record.metadata.billing_scope !== 'software' || record.metadata.user_id !== user.id ||
        stripeId(method.customer) !== customer) return { error: 'That card is not saved in Software billing.' } as const;
    await stripe.customers.update(customer, { invoice_settings: { default_payment_method: method.id } });
    revalidatePath('/software/account');
    return { success: true, message: 'Default Software payment method updated.' } as const;
  } catch (error) {
    console.error('Unable to update default software payment method:', error);
    return { error: 'Unable to update the default card.' } as const;
  }
}

export async function removeSoftwarePaymentMethod(paymentMethodIdValue: string) {
  const user = await currentUser();
  if (!user) return { error: 'Please sign in to manage software payment methods.' } as const;
  if (!/^pm_[a-zA-Z0-9]+$/.test(paymentMethodIdValue)) return { error: 'Invalid payment method.' } as const;
  try {
    const customer = await softwareCustomer(user.id);
    if (!customer) return { error: 'No software payment method is saved.' } as const;
    const stripe = await verifiedStripe();
    const [record, method] = await Promise.all([
      stripe.customers.retrieve(customer),
      stripe.paymentMethods.retrieve(paymentMethodIdValue),
    ]);
    if (record.deleted || !stripeObjectMatchesMode(record.livemode) ||
        record.metadata.billing_scope !== 'software' || record.metadata.user_id !== user.id ||
        stripeId(method.customer) !== customer) return { error: 'That card is not saved in Software billing.' } as const;
    const defaultValue = record.invoice_settings?.default_payment_method;
    const defaultId = typeof defaultValue === 'string' ? defaultValue : defaultValue?.id;
    if (defaultId === method.id) return { error: 'Set another default card before removing this one.' } as const;
    await stripe.paymentMethods.detach(method.id);
    revalidatePath('/software/account');
    return { success: true, message: 'Software payment method removed.' } as const;
  } catch (error) {
    console.error('Unable to remove software payment method:', error);
    return { error: 'Unable to remove this card.' } as const;
  }
}
