'use server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { ensureSignupCredits } from '@/lib/credits';
import { createAdminClient } from '@/utils/supabase/admin';

export async function getCreditBalance(): Promise<{ balance: number | null; error?: string }> {
  try {
    const client = await createSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { balance: null, error: 'Please sign in.' };
    await ensureSignupCredits(user.id);
    const { error: reconcileError } = await createAdminClient().rpc('reconcile_credit_usage', { p_user: user.id });
    if (reconcileError) throw reconcileError;
    const { data, error } = await createAdminClient().rpc('available_credits', { p_user: user.id });
    if (error) throw error;
    const balance = Number(data);
    if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Invalid balance.');
    return { balance };
  } catch { return { balance: null, error: 'Credit balance is temporarily unavailable.' }; }
}
