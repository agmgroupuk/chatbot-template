import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import Stripe from 'stripe';

function load(file, dependencies, env = {}) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  runInNewContext(outputText, { exports, require: name => dependencies[name] || {}, process: { env }, Response, Request, console });
  return exports;
}
const secret = 'whsec_unit_test_only';
const stripe = new Stripe('sk_test_unit_test_only');
test('webhook rejects missing, modified, stale signatures and every Live Mode event', async () => {
  let fulfilled = 0;
  const { POST } = load('app/api/stripe/webhook/route.ts', {
    '@/lib/stripe': { stripeClient: () => stripe, verifiedStripe: async () => stripe },
    '@/lib/stripe-fulfillment': { fulfillStripeEvent: async () => { fulfilled++; } },
  }, { STRIPE_SECRET_KEY: 'sk_test_unit_test_only', STRIPE_WEBHOOK_SECRET: secret });
  const payload = JSON.stringify({ id: 'evt_test', type: 'invoice.paid', livemode: false, data: { object: { id: 'in_test' } } });
  const sign = (value, timestamp) => stripe.webhooks.generateTestHeaderString({ payload: value, secret, timestamp });
  for (const [body, signature] of [[payload, ''], [payload + ' ', sign(payload)], [payload, sign(payload, 1)]]) {
    const response = await POST(new Request('https://example.test/api/stripe/webhook', { method: 'POST', body, headers: { 'stripe-signature': signature } }));
    assert.equal(response.status,400);
  }
  const live = payload.replace('"livemode":false','"livemode":true');
  assert.equal((await POST(new Request('https://example.test/api/stripe/webhook', { method: 'POST', body: live, headers: { 'stripe-signature': sign(live) } }))).status,400);
  assert.equal(fulfilled,0);
  assert.equal((await POST(new Request('https://example.test/api/stripe/webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': sign(payload) } }))).status,200);
  assert.equal(fulfilled,1);
});
test('only paid packs and paid renewal invoices allocate credits; retries use stable references', async () => {
  const grants = new Map();
  const { fulfillStripeEvent } = load('lib/stripe-fulfillment.ts', {
    './subscription-catalog':{managedPlan:()=>undefined},
    './billing-notices':{queueBillingNotice:async()=>{}},
    './db': {query:async (sql,values)=>{
      if(sql.startsWith('select user_id')) return [{user_id:'user-1'}];
      if(sql.startsWith('select grant_credits')) grants.set(values[1],{p_user:values[0],p_reference:values[1],p_amount:values[2],p_expires:values[3]});
      return [];
    }},
    './credit-config': { creditPlans: () => ({ price_pack: { credits: 50, kind: 'pack' }, price_month: { credits: 100, kind: 'subscription' } }) },
  });
  const session = { id: 'cs_test_1', mode: 'payment', metadata: { app: 'chatbot-template' }, customer: 'cus_test', payment_status: 'unpaid', livemode: false, currency: 'usd' };
  const api = { subscriptions: { retrieve: async () => ({ id: 'sub_test', livemode: false, items: { data: [{ price: { id: 'price_month' }, current_period_start: 1990000000, current_period_end: 2000000000 }] }, status: 'active', cancel_at_period_end: false }) }, checkout: { sessions: { retrieve: async () => session, listLineItems: async function* () { yield { id: 'li_pack', price: { id: 'price_pack' }, quantity: 1 }; } } },
    invoices: { retrieve: async () => ({ id: 'in_test', parent: { subscription_details: { subscription: 'sub_test', metadata: { app: 'chatbot-template' } } }, customer: 'cus_test', livemode: false, currency: 'usd', status: 'paid' }),
      listLineItems: async function* () { yield { id: 'li_invoice', pricing: { price_details: { price: 'price_month' } }, quantity: 1, amount: 900, period: { end: 2000000000 } }; } },
  };
  const event = type => ({ type, livemode: false, data: { object: { id: 'cs_test_1' } } });
  await fulfillStripeEvent(api,event('checkout.session.completed'));
  assert.equal(grants.size,0);
  session.payment_status = 'paid';
  await fulfillStripeEvent(api,event('checkout.session.completed'));
  await fulfillStripeEvent(api,event('checkout.session.async_payment_succeeded'));
  assert.equal(grants.size,1);
  assert.equal(grants.get('checkout:cs_test_1:li_pack').p_amount,50);
  await fulfillStripeEvent(api,event('invoice.paid'));
  await fulfillStripeEvent(api,event('invoice.paid'));
  assert.equal(grants.size,2);
  assert.equal(grants.get('subscription:sub_test:invoice:in_test:li_invoice').p_amount,100);
  assert.equal(grants.get('subscription:sub_test:invoice:in_test:li_invoice').p_expires,'2033-05-18T03:33:20.000Z');
  await fulfillStripeEvent(api,event('invoice.payment_failed'));
  assert.equal(grants.size,2);
  await assert.rejects(fulfillStripeEvent(api,{ ...event('invoice.paid'),livemode:true }),/Live events/);
});
