import 'server-only';
import { query,ownedQuery } from './db';
import { ensureSignupCredits } from './credits';
import { readPreferences } from './account-service';
export async function dashboardData(userId:string) {
  await ensureSignupCredits(userId);
  const [profiles,counts,credits,chats,subscriptions,usage,requests,preferences,access]=await Promise.all([
    ownedQuery(userId,'select full_name from profiles where id=$1',[userId]),
    query<{chats:string;contexts:string;responses:string}>(`select (select count(*) from chats where user_id=$1) as chats,(select count(*) from context_items where user_id=$1) as contexts,(select count(*) from credit_usage where user_id=$1 and status='completed') as responses`,[userId]),
    ownedQuery(userId,'select coalesce(sum(remaining),0)::text as balance from credit_buckets where user_id=$1 and (expires_at is null or expires_at>now())',[userId]),
    ownedQuery(userId,'select id,name,updated_at::text from chats where user_id=$1 order by updated_at desc limit 5',[userId]),
    ownedQuery(userId,'select id,status,price_id,period_end::text,cancel_at_period_end,observed_at::text from billing_subscriptions where user_id=$1 order by observed_at desc limit 5',[userId]),
    query('select id,status,created_at::text from credit_usage where user_id=$1 order by created_at desc limit 8',[userId]),
    ownedQuery(userId,"select count(*)::text as count from support_requests where user_id=$1 and status<>'resolved'",[userId]),
    readPreferences(userId),
    ownedQuery(userId,'select 1 from membership_access where user_id=$1 and expires_at>now() limit 1',[userId]),
  ]);
  return {name:profiles[0]?.full_name||'',counts:counts[0],balance:access.length?'Unlimited':credits[0]?.balance||'0',chats,subscriptions,usage,openRequests:requests[0]?.count||'0',preferences};
}
export function accountDate(value:string,timezone:string) { return new Date(value).toLocaleString('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}); }
