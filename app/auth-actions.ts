'use server';
import { createSupabaseClient } from '@/utils/supabase/server';
import { siteUrl } from '@/lib/site-url';
import { encodedRedirect } from '@/utils/redirect';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function forgotPasswordAction(form: FormData) {
  const email = String(form.get('email') || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return encodedRedirect('error', '/forgot-password', 'Enter a valid email address.');
  const client = await createSupabaseClient();
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` });
  if (error) return encodedRedirect('error', '/forgot-password', 'Unable to send a reset link. Please try again later.');
  return encodedRedirect('success', '/forgot-password', 'If an account exists, a reset link has been sent.');
}

export async function resetPasswordAction(form: FormData) {
  const password = String(form.get('password') || '');
  if (password.length < 8 || password !== form.get('confirmPassword')) return encodedRedirect('error', '/reset-password', 'Passwords must match and contain at least eight characters.');
  const client = await createSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return redirect('/forgot-password');
  const { error } = await client.auth.updateUser({ password });
  if (error) return encodedRedirect('error', '/reset-password', 'Unable to update password. Request a new link and try again.');
  await client.auth.signOut({ scope: 'global' });
  return encodedRedirect('success', '/sign-in', 'Password updated. Please sign in again.');
}

export async function googleSignInAction() {
  const client = await createSupabaseClient();
  const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${siteUrl()}/auth/callback` } });
  if (error || !data.url) return encodedRedirect('error', '/sign-in', 'Google sign in is unavailable. Please use email.');
  return redirect(data.url);
}

export async function updateProfileAction(form: FormData) {
  const client = await createSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return redirect('/sign-in');
  const full_name = String(form.get('full_name') || '').trim();
  if (full_name.length > 120) return encodedRedirect('error', '/account', 'Name must be at most 120 characters.');
  const { error } = await client.from('profiles').upsert({ id: user.id, full_name, updated_at: new Date().toISOString() });
  if (error) return encodedRedirect('error', '/account', 'Unable to save your profile.');
  revalidatePath('/account');
  return encodedRedirect('success', '/account', 'Profile saved.');
}
