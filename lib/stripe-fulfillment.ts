import 'server-only';
import Stripe from 'stripe';
import { query } from './db';
import { creditPlans } from './credit-config';
import { managedPlan } from './subscription-catalog';
import { queueBillingNotice } from './billing-notices';
import { priceLabel } from './plans';

async function owner(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  const id = typeof customer === 'string' ? customer : customer?.id;
  if (!id) throw new Error('Missing customer.');
  const [data]=await query('select user_id from billing_customers where customer_id=$1',[id]);
  if (!data) throw new Error('Customer mapping unavailable.');
  return data.user_id as string;
}
async function grant(user: string, reference: string, price: string, quantity: number, kind: 'subscription' | 'pack', expires?: number) {
  const plan = creditPlans()[price];
  if (!plan || plan.kind !== kind || quantity !== 1) throw new Error('Unexpected paid price or quantity.');
  await query('select grant_credits($1,$2,$3,$4)',[user,reference,plan.credits,expires?new Date(expires*1000).toISOString():null]);
}
async function recordSubscription(user: string, sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  if (!item || sub.livemode) throw new Error('Invalid subscription snapshot.');
  await query(`insert into billing_subscriptions(id,user_id,price_id,status,period_start,period_end,cancel_at_period_end,observed_at)
    values($1,$2,$3,$4,$5,$6,$7,now()) on conflict(id) do update set price_id=excluded.price_id,status=excluded.status,period_start=excluded.period_start,period_end=excluded.period_end,cancel_at_period_end=excluded.cancel_at_period_end,observed_at=excluded.observed_at`,
    [sub.id,user,item.price.id,sub.status,new Date(item.current_period_start*1000).toISOString(),new Date(item.current_period_end*1000).toISOString(),sub.cancel_at_period_end]);
  await query('update billing_subscriptions set trial_end=$2 where id=$1',[sub.id,sub.trial_end?new Date(sub.trial_end*1000).toISOString():null]);
  await query('update billing_subscriptions set next_plan_key=null,next_plan_at=null where id=$1 and next_plan_at<=$2',[sub.id,new Date(item.current_period_start*1000).toISOString()]);
  const plan=managedPlan(item.price);
  if(plan && sub.status==='trialing' && sub.trial_end && sub.default_payment_method) {
    const [claim]=await query('select 1 from billing_trial_claims where user_id=$1 and request_id=$2',[user,sub.metadata.enrollment_id]);
    if(claim) {
      await query(`insert into membership_access(subscription_id,user_id,plan_key,expires_at) values($1,$2,$3,$4)
        on conflict(subscription_id) do update set expires_at=excluded.expires_at,plan_key=excluded.plan_key,updated_at=now()`,[sub.id,user,plan.key,new Date(sub.trial_end*1000).toISOString()]);
      await queueBillingNotice(`trial:${sub.id}`,user,'Your trial has started',`Your ${plan.trialDays}-day ${plan.name} trial ends ${new Date(sub.trial_end*1000).toISOString()}. Your saved card will then be charged ${priceLabel(plan)} automatically unless you cancel before that time. Manage or cancel at https://onefinsolution.online/dashboard/billing.`);
    }
  }
  if(['canceled','unpaid','paused','incomplete_expired'].includes(sub.status)) await query('update membership_access set expires_at=least(expires_at,now()),updated_at=now() where subscription_id=$1',[sub.id]);
}
export async function fulfillStripeEvent(stripe: Stripe, event: Stripe.Event) {
  if (event.livemode) throw new Error('Live events are disabled.');
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    const session = await stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id);
    if (session.metadata?.app !== 'chatbot-template' || session.mode !== 'payment' || session.payment_status !== 'paid') return;
    if (session.livemode || session.currency !== 'usd') throw new Error('Unexpected checkout currency or mode.');
    const user = await owner(session.customer);
    for await (const item of stripe.checkout.sessions.listLineItems(session.id, { limit: 100 })) {
      if (!item.price) throw new Error('Missing price.');
      await grant(user, `checkout:${session.id}:${item.id}`, item.price.id, item.quantity || 0, 'pack');
    }
  } else if (event.type === 'invoice.paid') {
    const invoice = await stripe.invoices.retrieve(event.data.object.id);
    if (invoice.parent?.subscription_details?.metadata?.app !== 'chatbot-template') return;
    if (invoice.livemode || invoice.status !== 'paid' || invoice.currency !== 'usd') throw new Error('Unexpected invoice.');
    const user = await owner(invoice.customer);
    const source = invoice.parent.subscription_details.subscription;
    const subscriptionId = typeof source === 'string' ? source : source?.id;
    if (!subscriptionId) throw new Error('Missing invoice subscription.');
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    await recordSubscription(user, sub);
    const managed=managedPlan(sub.items.data[0].price);
    if(managed) {
      // The zero-dollar trial invoice is not a paid membership. Read invoice
      // lines, not the latest subscription period, when handling delayed events.
      if(invoice.amount_paid<=0 || invoice.amount_remaining!==0 || sub.status==='canceled') return;
      for await(const line of stripe.invoices.listLineItems(invoice.id,{limit:100})) {
        if(line.parent?.subscription_item_details?.proration || line.amount<=0 || line.quantity!==1) continue;
        const source=line.pricing?.price_details?.price;
        const price=typeof source==='string'?await stripe.prices.retrieve(source):source;
        const paidPlan=price?managedPlan(price):undefined;
        if(!paidPlan) throw new Error('Unknown membership price.');
        await query(`insert into membership_access(subscription_id,user_id,plan_key,expires_at) values($1,$2,$3,$4)
          on conflict(subscription_id) do update set plan_key=case when excluded.expires_at>=membership_access.expires_at then excluded.plan_key else membership_access.plan_key end,expires_at=greatest(membership_access.expires_at,excluded.expires_at),updated_at=now()`,[sub.id,user,paidPlan.key,new Date(line.period.end*1000).toISOString()]);
      }
      await queueBillingNotice(`paid:${invoice.id}`,user,'Payment received',`Payment of ${(invoice.amount_paid/100).toFixed(2)} ${invoice.currency.toUpperCase()} received. Review your plan and renewal at https://onefinsolution.online/dashboard/billing.`);
      return;
    }
    for await (const line of stripe.invoices.listLineItems(invoice.id, { limit: 100 })) {
      // Plan changes are scheduled at renewal, so prorations must not allocate a full allowance.
      if (line.parent?.subscription_item_details?.proration || line.amount < 0) continue;
      const price = line.pricing?.price_details?.price;
      const id = typeof price === 'string' ? price : price?.id;
      if (!id) throw new Error('Missing invoice price.');
      await grant(user, `subscription:${subscriptionId}:invoice:${invoice.id}:${line.id}`, id, line.quantity || 0, 'subscription', sub.ended_at ? Math.min(sub.ended_at,line.period.end) : line.period.end);
    }
  } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'customer.subscription.trial_will_end'].includes(event.type)) {
    // Retrieve current state so delayed events cannot restore an old subscription status.
    const sub = await stripe.subscriptions.retrieve((event.data.object as Stripe.Subscription).id);
    if (sub.metadata.app !== 'chatbot-template') return;
    const user = await owner(sub.customer);
    await recordSubscription(user,sub);
    if(event.type==='customer.subscription.trial_will_end' && sub.status==='trialing') await queueBillingNotice(`trial-ending:${sub.id}:${sub.trial_end}`,user,'Your trial is ending',`Your trial ends ${new Date(sub.trial_end!*1000).toISOString()}. Your saved card will be charged automatically unless you cancel. Review the price or cancel at https://onefinsolution.online/dashboard/billing.`);
    if (sub.status === 'canceled') {
      const expires = new Date((sub.ended_at || Math.floor(Date.now()/1000)) * 1000).toISOString();
      await query('update credit_buckets set expires_at=$1 where user_id=$2 and reference like $3 and expires_at>$1',[expires,user,`subscription:${sub.id}:%`]);
    }
  } else if(['invoice.payment_failed','invoice.payment_action_required'].includes(event.type)) {
    const invoice=await stripe.invoices.retrieve((event.data.object as Stripe.Invoice).id);
    if(invoice.parent?.subscription_details?.metadata?.app!=='chatbot-template') return;
    const user=await owner(invoice.customer);
    await queueBillingNotice(`${event.type}:${invoice.id}`,user,'Your payment needs attention','We could not complete your payment. Access will not extend until payment is confirmed. Open https://onefinsolution.online/dashboard/billing to update your card or authenticate the payment.');
  }
  // Failed/cancelled checkout, unpaid invoice and cancelled subscriptions grant nothing.
  // Subscription bucket expiry is enforced in every atomic reservation.
}
