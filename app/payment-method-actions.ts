'use server';

import { currentUser } from '@/lib/session';
import { currentCustomer } from '@/lib/stripe-billing';
import { verifiedStripe } from '@/lib/stripe';
import { throttle } from '@/lib/auth-service';
import { randomUUID } from 'node:crypto';
import { fulfillStripeEvent } from '@/lib/stripe-fulfillment';
import { expectedStripeLivemode, stripeObjectMatchesMode } from '@/lib/billing-environment';
import type Stripe from 'stripe';

async function context() {
  const user = await currentUser();
  if (!user) throw new Error('Please sign in.');
  await throttle(`payment-method:${user.id}`, 20);
  const customer = await currentCustomer();
  if (!customer) throw new Error('No billing account exists yet.');
  return { user, customer, stripe: await verifiedStripe() };
}

export type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
};

export async function listPaymentMethodsAction(): Promise<
  { methods: SavedPaymentMethod[]; customerId: string } | { error: string }
> {
  try {
    const { customer, stripe } = await context();
    const customerObj = await stripe.customers.retrieve(customer);
    if (customerObj.deleted) return { error: 'Billing customer is no longer available.' };
    const defaultId =
      typeof customerObj.invoice_settings?.default_payment_method === 'string'
        ? customerObj.invoice_settings.default_payment_method
        : customerObj.invoice_settings?.default_payment_method?.id || null;

    const listed = await stripe.paymentMethods.list({ customer, type: 'card', limit: 20 });
    const methods: SavedPaymentMethod[] = listed.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || 'card',
      last4: pm.card?.last4 || '••••',
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
      isDefault: pm.id === defaultId,
    }));
    methods.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    return { methods, customerId: customer };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unable to load payment methods.',
    };
  }
}

export async function prepareCardUpdate() {
  try {
    const { user, customer, stripe } = await context();
    const setup = await stripe.setupIntents.create(
      {
        customer,
        usage: 'off_session',
        allowed_payment_method_types: ['card'],
        metadata: { app: 'chatbot-template', purpose: 'update-card', user_id: user.id },
      } as Stripe.SetupIntentCreateParams,
      { idempotencyKey: `onefin-card:${user.id}:${randomUUID()}` },
    );
    if (!stripeObjectMatchesMode(setup.livemode)) throw new Error();
    return { secret: setup.client_secret };
  } catch {
    return { error: 'Unable to prepare a card update. Please try again.' };
  }
}

export async function finishCardUpdate(setupId: string) {
  try {
    const { user, customer, stripe } = await context();
    const setup = await stripe.setupIntents.retrieve(setupId);
    if (
      !stripeObjectMatchesMode(setup.livemode) ||
      setup.customer !== customer ||
      setup.status !== 'succeeded' ||
      setup.metadata?.purpose !== 'update-card' ||
      setup.metadata.user_id !== user.id
    ) {
      throw new Error();
    }
    const method =
      typeof setup.payment_method === 'string' ? setup.payment_method : setup.payment_method?.id;
    if (!method) throw new Error();
    await stripe.customers.update(customer, {
      invoice_settings: { default_payment_method: method },
    });
    for await (const sub of stripe.subscriptions.list({ customer, status: 'all', limit: 100 })) {
      if (sub.metadata.app === 'chatbot-template' && !['canceled', 'incomplete_expired'].includes(sub.status)) {
        await stripe.subscriptions.update(sub.id, { default_payment_method: method });
      }
    }
    return { success: true };
  } catch {
    return { error: 'Unable to save this card. Please retry verification.' };
  }
}

export async function setDefaultPaymentMethodAction(paymentMethodId: string) {
  try {
    if (!paymentMethodId.startsWith('pm_')) return { error: 'Invalid payment method.' };
    const { customer, stripe } = await context();
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== customer) return { error: 'That card is not on your account.' };
    await stripe.customers.update(customer, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    for await (const sub of stripe.subscriptions.list({ customer, status: 'all', limit: 100 })) {
      if (sub.metadata.app === 'chatbot-template' && !['canceled', 'incomplete_expired'].includes(sub.status)) {
        await stripe.subscriptions.update(sub.id, { default_payment_method: paymentMethodId });
      }
    }
    return { success: true as const, message: 'Default payment method updated.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unable to set default payment method.',
    };
  }
}

export async function detachPaymentMethodAction(paymentMethodId: string) {
  try {
    if (!paymentMethodId.startsWith('pm_')) return { error: 'Invalid payment method.' };
    const { customer, stripe } = await context();
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== customer) return { error: 'That card is not on your account.' };

    const customerObj = await stripe.customers.retrieve(customer);
    if (!customerObj.deleted) {
      const defaultId =
        typeof customerObj.invoice_settings?.default_payment_method === 'string'
          ? customerObj.invoice_settings.default_payment_method
          : customerObj.invoice_settings?.default_payment_method?.id || null;
      if (defaultId === paymentMethodId) {
        return { error: 'Set another default card before removing this one.' };
      }
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    return { success: true as const, message: 'Payment method removed.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unable to remove this payment method.',
    };
  }
}

export async function retrySubscriptionPayment(subscriptionId: string) {
  try {
    const { customer, stripe } = await context();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    if (
      !stripeObjectMatchesMode(sub.livemode) ||
      sub.customer !== customer ||
      sub.metadata.app !== 'chatbot-template'
    ) {
      throw new Error();
    }
    const invoiceId = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id;
    if (!invoiceId) throw new Error();
    let invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['confirmation_secret'] });
    if (!stripeObjectMatchesMode(invoice.livemode)) throw new Error();
    if (invoice.status !== 'paid') {
      try {
        invoice = await stripe.invoices.pay(invoiceId, { expand: ['confirmation_secret'] });
      } catch {
        invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['confirmation_secret'] });
      }
      if (!stripeObjectMatchesMode(invoice.livemode)) throw new Error();
    }
    if (invoice.status === 'paid') {
      await fulfillStripeEvent(stripe, {
        type: 'invoice.paid',
        livemode: expectedStripeLivemode(),
        data: { object: { id: invoice.id } },
      } as Stripe.Event);
      return { paid: true };
    }
    if (invoice.confirmation_secret?.client_secret) {
      return { secret: invoice.confirmation_secret.client_secret };
    }
    return { error: 'Payment could not complete. Update your card and retry.' };
  } catch {
    return { error: 'Unable to retry this payment. Please contact support.' };
  }
}
