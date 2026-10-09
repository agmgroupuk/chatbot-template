export const plans = [
  { key: 'daily', name: 'Daily', amount: 500, interval: 'day', trialDays: 1 },
  { key: 'weekly', name: 'Weekly', amount: 1300, interval: 'week', trialDays: 2 },
  { key: 'monthly', name: 'Monthly', amount: 3000, interval: 'month', trialDays: 3 },
  { key: 'yearly', name: 'Yearly', amount: 24900, interval: 'year', trialDays: 5 },
] as const;
export type PlanKey = typeof plans[number]['key'];
export function findPlan(key: string) {
  const plan = plans.find(value => value.key === key);
  if (!plan) throw new Error('Choose an available plan.');
  return plan;
}
export const priceLabel = (plan: typeof plans[number]) => `$${plan.amount / 100} USD / ${plan.interval}`;
export const lookupKey = (key: string) => `onefin_v2_${findPlan(key).key}`;
