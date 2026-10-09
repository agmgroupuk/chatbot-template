import 'server-only';
import Stripe from 'stripe';
import { verifiedStripe } from './stripe';
import { creditPlans } from './credit-config';
import { currentUser } from './session';
import { query } from './db';
import { siteUrl } from './site-url';
import type { Price, Product, ProductWithPrices, Subscription } from '@/types/billing';

function priceView(price: Stripe.Price): Price {
  return { id: price.id, type: price.recurring ? 'recurring' : 'one-time', currency: price.currency,
    unit_amount: price.unit_amount!, interval: price.recurring?.interval || '', interval_count: price.recurring?.interval_count || 1 };
}
function productView(product: Stripe.Product): Product {
  return { id: product.id, name: product.name, description: product.description || '', status: product.active ? 'active' : 'inactive' };
}
async function currentCustomer(create=false) {
  const user=await currentUser();
  if(!user) throw new Error('Please sign in.');
  const [mapping]=await query<{customer_id:string}>('select customer_id from billing_customers where user_id=$1',[user.id]);
  if(mapping) return mapping.customer_id;
  if(!create) return null;
  const stripe=await verifiedStripe();
  const customer=await stripe.customers.create({email:user.email,metadata:{app:'chatbot-template',user_id:user.id}},{idempotencyKey:`chatbot-customer:${user.id}`});
  await query('insert into billing_customers(user_id,customer_id) values($1,$2) on conflict(user_id) do nothing',[user.id,customer.id]);
  const [saved]=await query('select customer_id from billing_customers where user_id=$1',[user.id]);
  if(saved?.customer_id!==customer.id) throw new Error('Billing account conflict.');
  return customer.id;
}

async function catalog() {
  const stripe = await verifiedStripe();
  const ids = Object.keys(creditPlans());
  if (ids.length === 0) throw new Error('No Stripe credit plans are configured.');
  const products = new Map<string, ProductWithPrices>();
  for (const id of ids) {
    const price = await stripe.prices.retrieve(id, { expand: ['product'] });
    const product = price.product as Stripe.Product;
    if (price.livemode || !price.active || price.currency !== 'usd' || price.unit_amount === null || product.deleted || !product.active) throw new Error('Configured catalog contains an unavailable price.');
    const plan = creditPlans()[id];
    if (Boolean(price.recurring) !== (plan.kind === 'subscription')) throw new Error('Credit plan type does not match Stripe price.');
    const existing = products.get(product.id) || { ...productView(product), prices: [] };
    existing.prices.push(priceView(price));
    products.set(product.id, existing);
  }
  return Array.from(products.values());
}
async function subscriptions(): Promise<Subscription[]> {
  const customer = await currentCustomer();
  if (!customer) return [];
  const stripe = await verifiedStripe();
  const data = await stripe.subscriptions.list({ customer, status: 'all', limit: 100, expand: ['data.items.data.price.product'] });
  return data.data.map(sub => {
    const item = sub.items.data[0];
    return { id: sub.id, status: sub.status === 'active' ? 'active' : sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due' : 'inactive',
      price: priceView(item.price), product: productView(item.price.product as Stripe.Product),
      cancel_at_period_end: sub.cancel_at_period_end, canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      current_period_start: new Date(item.current_period_start * 1000).toISOString(), current_period_end: new Date(item.current_period_end * 1000).toISOString() };
  });
}
async function checkout(priceId: string) {
  const products = await catalog();
  const price = products.flatMap(product => product.prices).find(price => price.id === priceId);
  if (!price) throw new Error('Price not available.');
  const customer = await currentCustomer(true);
  const stripe = await verifiedStripe();
  if (price.type === 'recurring') {
    const existing = await stripe.subscriptions.list({ customer: customer!, status: 'all', limit: 100 });
    if (existing.data.some(sub => !['canceled','incomplete_expired'].includes(sub.status))) throw new Error('Manage your existing subscription first.');
  }
  const [mapping]=await query('select user_id from billing_customers where customer_id=$1',[customer]);
  if(!mapping) throw new Error('Billing account unavailable.');
  for (let retry = 0; retry < 3; retry++) {
    const [{attempt}]=await query('select begin_billing_checkout($1,$2) as attempt',[mapping.user_id,priceId]);
    if(!attempt) throw new Error('Unable to reserve checkout.');
    const pending = products.flatMap(product => product.prices).find(value => value.id === attempt.price_id);
    if (!pending) throw new Error('The unfinished checkout price is no longer available. Contact support.');
    const session = attempt.session_id ? await stripe.checkout.sessions.retrieve(attempt.session_id) :
      await stripe.checkout.sessions.create({ customer: customer!, mode: pending.type === 'recurring' ? 'subscription' : 'payment',
        line_items: [{ price: pending.id, quantity: 1 }], success_url: `${siteUrl()}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${siteUrl()}/pricing?checkout=cancelled`,
        metadata: { app: 'chatbot-template' }, ...(pending.type === 'recurring' ? { subscription_data: { metadata: { app: 'chatbot-template' } } } : {}),
      }, { idempotencyKey: `chatbot-checkout:${attempt.request_id}` });
    if (session.livemode || session.customer !== customer) throw new Error('Unexpected checkout account or mode.');
    if (session.status !== 'open' || attempt.price_id !== priceId) {
      if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
      await query('delete from billing_checkout_attempts where user_id=$1 and request_id=$2',[mapping.user_id,attempt.request_id]);
      if (pending.type === 'recurring' && price.type === 'recurring' && session.status === 'complete') throw new Error('Your previous checkout completed. Refresh your subscription before purchasing again.');
      continue;
    }
    const saved=await query('update billing_checkout_attempts set session_id=$1 where user_id=$2 and request_id=$3 returning request_id',[session.id,mapping.user_id,attempt.request_id]);
    if (!saved?.length || !session.url) throw new Error('Checkout changed in another tab. Please try again.');
    return session.url;
  }
  throw new Error('Another checkout is in progress. Please try again.');
}

// The same response contract keeps existing pricing and subscription components intact.
export function createStripeBilling() {
  return {
    async getProducts() {
      try { return { data: { products: await catalog() }, error: null }; }
      catch { return { data: { products: null }, error: { message: 'Unable to load plans.' } }; }
    },
    async getSubscriptions() {
      try { return { data: { subscriptions: await subscriptions() }, error: null }; }
      catch { return { data: { subscriptions: null }, error: { message: 'Unable to load subscriptions.' } }; }
    },
    async createCheckoutSession(id: string) {
      try { return { data: { url: await checkout(id) }, error: null }; }
      catch (error) { return { data: { url: null }, error: { message: error instanceof Error ? error.message : 'Unable to create checkout.' } }; }
    },
    async updateSubscription(id: string, settings: { cancel_at_period_end: boolean }) {
      try {
        const customer = await currentCustomer();
        const stripe = await verifiedStripe();
        const sub = await stripe.subscriptions.retrieve(id);
        if (!customer || sub.customer !== customer || sub.livemode) throw new Error('Subscription not found.');
        if (settings.cancel_at_period_end && sub.schedule) {
          const schedule = await stripe.subscriptionSchedules.retrieve(typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id);
          if (schedule.metadata?.app !== 'chatbot-template') throw new Error('Subscription schedule is managed outside this app.');
          await stripe.subscriptionSchedules.release(schedule.id);
        }
        await stripe.subscriptions.update(id, settings);
        return { data: { subscription: null }, error: null };
      } catch { return { data: { subscription: null }, error: { message: 'Unable to update subscription.' } }; }
    },
  };
}

export async function schedulePlanChange(priceId: string) {
  const products = await catalog();
  const price = products.flatMap(product => product.prices).find(price => price.id === priceId);
  if (!price || price.type !== 'recurring') throw new Error('Select a subscription price.');
  const customer = await currentCustomer();
  if (!customer) throw new Error('No subscription found.');
  const stripe = await verifiedStripe();
  const subscriptions = await stripe.subscriptions.list({ customer, status: 'active', limit: 2 });
  if (subscriptions.data.length !== 1) throw new Error('Unable to identify a single active subscription.');
  const sub = subscriptions.data[0];
  if (sub.cancel_at_period_end) throw new Error('Reactivate your subscription before changing plans.');
  const item = sub.items.data[0];
  if (sub.items.data.length !== 1 || item.quantity !== 1) throw new Error('This subscription must be managed by support.');
  if (item.price.id === priceId) throw new Error('This price is already active.');
  let created = false;
  const schedule = sub.schedule
    ? await stripe.subscriptionSchedules.retrieve(typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id)
    : await stripe.subscriptionSchedules.create({ from_subscription: sub.id, metadata: { app: 'chatbot-template' } }).then(value => { created = true; return value; });
  if (!created && schedule.metadata?.app !== 'chatbot-template') throw new Error('The existing schedule is managed outside this app.');
  try {
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release', proration_behavior: 'none',
      phases: [
        { start_date: item.current_period_start, end_date: item.current_period_end, items: [{ price: item.price.id, quantity: 1 }], proration_behavior: 'none' },
        { items: [{ price: priceId, quantity: 1 }], duration: { interval: price.interval as 'month' | 'year', interval_count: price.interval_count }, proration_behavior: 'none' },
      ],
    });
  } catch (error) {
    if (created) await stripe.subscriptionSchedules.release(schedule.id);
    throw error;
  }
  return new Date(item.current_period_end * 1000).toISOString();
}
