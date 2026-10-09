import 'server-only';
import Stripe from 'stripe';

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^(sk|rk)_test_/.test(key)) throw new Error('A Stripe Test Mode secret key is required.');
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 });
}
export async function verifiedStripe() {
  const stripe = stripeClient();
  const expected = process.env.STRIPE_EXPECTED_ACCOUNT_ID;
  if (!expected) throw new Error('STRIPE_EXPECTED_ACCOUNT_ID is required.');
  const [account, balance] = await Promise.all([stripe.accounts.retrieve(null), stripe.balance.retrieve()]);
  if (account.id !== expected || balance.livemode) throw new Error('Stripe account or mode does not match this application.');
  return stripe;
}
