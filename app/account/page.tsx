import { createSupabaseClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getSubscriptionDetails, signOutAction } from '@/app/actions';
import { updateProfileAction } from '@/app/auth-actions';
import Link from 'next/link';

export default async function Account({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; checkout?: string }> }) {
  const client = await createSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/sign-in');
  const [{ data: profile, error }, subscription, params] = await Promise.all([
    client.from('profiles').select('full_name').eq('id', user.id).maybeSingle(), getSubscriptionDetails(), searchParams,
  ]);
  return <section className="mx-auto w-full max-w-xl overflow-y-auto p-6 text-stone-900">
    <h1 className="mb-6 text-3xl">Your account</h1>
    {error && <p role="alert">Unable to load your profile. Please try again.</p>}
    {params.error && <p role="alert" className="text-red-700">{params.error}</p>}
    {params.success && <p role="status">{params.success}</p>}
    {params.checkout === 'success' && <p role="status">Checkout returned successfully. Your plan appears after payment confirmation; refresh if it is still processing.</p>}
    <p className="my-4 break-all">Email: {user.email}</p>
    <form action={updateProfileAction} className="space-y-4">
      <label className="block">Full name<input name="full_name" maxLength={120} defaultValue={profile?.full_name || ''} className="mt-2 w-full rounded-xl border p-3" /></label>
      <button className="rounded-xl bg-zinc-900 px-5 py-3 text-white">Save profile</button>
    </form>
    {subscription.error ? <p role="alert" className="mt-6">{subscription.error}</p> : <p className="mt-6">Active plan: {subscription.planName || 'No active subscription'}</p>}
    {subscription.renewalDate && <p>{subscription.isCancelled ? 'Access ends' : 'Renews'}: {subscription.renewalDate}</p>}
    <Link href="/pricing" className="my-4 block underline">Manage subscription</Link>
    <Link href="/forgot-password" className="my-4 block underline">Reset password</Link>
    <form action={signOutAction}><button className="rounded-xl border px-5 py-3">Log out</button></form>
  </section>;
}
