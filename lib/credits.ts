import 'server-only';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { chatCreditCost, signupCredits } from './credit-config';

export async function ensureSignupCredits(userId: string) {
  const amount = signupCredits();
  if (amount === 0) return;
  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin.from('credit_buckets').select('user_id').eq('reference', `signup:${userId}`).maybeSingle();
  if (lookupError) throw new Error('Unable to initialize credits.');
  if (existing?.user_id === userId) return;
  const { error } = await admin.rpc('grant_credits', {
    p_user: userId, p_reference: `signup:${userId}`, p_amount: amount,
  });
  if (error) throw new Error('Unable to initialize credits.');
}
export async function reserveChatCredits(userId: string) {
  await ensureSignupCredits(userId);
  const requestId = randomUUID();
  const { error } = await createAdminClient().rpc('reserve_credits', {
    p_user: userId, p_request: requestId, p_cost: chatCreditCost(),
  });
  if (error) throw new Error(error.message.includes('Insufficient credits') ? 'Not enough credits. Choose a plan or buy a credit pack.' : 'Unable to reserve credits. Please try again.');
  return requestId;
}
export async function finishChatCredits(userId: string, requestId: string, success: boolean) {
  const { error } = await createAdminClient().rpc('finish_credit_usage', { p_user: userId, p_request: requestId, p_success: success });
  if (error) throw new Error('Unable to finalize credit usage.');
}
