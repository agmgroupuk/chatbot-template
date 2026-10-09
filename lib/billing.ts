import 'server-only';
import { createStripeBilling } from './stripe-billing';
import { billingEnvironment } from './billing-environment';
export async function createBillingClient() {
  billingEnvironment();
  const billing=createStripeBilling();
  return {billing,entitlements:{async check() { const result=await billing.getSubscriptions(); return {data:{hasAccess:result.data.subscriptions?.some(sub=>sub.status==='active')||false},error:result.error}; }}};
}
