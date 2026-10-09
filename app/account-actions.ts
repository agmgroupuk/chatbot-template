'use server';
import { currentUser, sessionCookie, destroySession } from '@/lib/session';
import { readPreferences, savePreferences, changePassword, revokeOtherSessions } from '@/lib/account-service';
import { parsePreferences, defaultPreferences } from '@/lib/account-preferences';
import { throttle } from '@/lib/auth-service';
import { tokenHash } from '@/lib/password';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { encodedRedirect } from '@/utils/redirect';
export async function getPreferencesAction() {
  const user=await currentUser();
  return user ? readPreferences(user.id) : defaultPreferences;
}
export async function savePreferencesAction(form:FormData) {
  const user=await currentUser(); if(!user) redirect('/sign-in');
  try { await savePreferences(user.id,parsePreferences(form)); }
  catch(error) { return encodedRedirect('error','/account/preferences',error instanceof Error && /Choose/.test(error.message)?error.message:'Unable to save preferences. Please try again.'); }
  revalidatePath('/account'); revalidatePath('/dashboard');
  return encodedRedirect('success','/account/preferences','Preferences saved.');
}
export async function changePasswordAction(form:FormData) {
  const user=await currentUser(); if(!user) redirect('/sign-in');
  try {
    await throttle(`change-password:${user.id}`,5);
    const password=String(form.get('password')||'');
    if(password!==form.get('confirmPassword')) throw new Error('Passwords must match.');
    await changePassword(user.id,String(form.get('currentPassword')||''),password);
  } catch(error) { return encodedRedirect('error','/account/security',error instanceof Error && /password|Choose|Too many/.test(error.message)?error.message:'Unable to change your password.'); }
  await destroySession();
  return encodedRedirect('success','/sign-in','Password changed. All sessions were signed out. Please sign in again.');
}
export async function revokeSessionsAction(form:FormData) {
  const user=await currentUser(); if(!user) redirect('/sign-in');
  try {
    const token=(await cookies()).get(sessionCookie)?.value;
    if(!token) redirect('/sign-in');
    await revokeOtherSessions(user.id,tokenHash(token),String(form.get('created_at')||'')||undefined);
  } catch { return encodedRedirect('error','/account/security','Unable to sign out the selected sessions.'); }
  revalidatePath('/account/security');
  return encodedRedirect('success','/account/security','Other selected sessions have been signed out.');
}
