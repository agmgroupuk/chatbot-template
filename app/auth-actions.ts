'use server';
import { currentUser, destroySession } from '@/lib/session';
import { requestEmailToken, resetPassword, throttle } from '@/lib/auth-service';
import { query } from '@/lib/db';
import { cookies, headers } from 'next/headers';
import { encodedRedirect } from '@/utils/redirect';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
export async function authRequestThrottle() {
  const ip=(await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  await throttle(`auth-ip:${ip}`,50);
}
export async function forgotPasswordAction(form:FormData) {
  try { await authRequestThrottle(); await requestEmailToken(String(form.get('email')||''),'reset'); }
  catch(error) { return encodedRedirect('error','/forgot-password',error instanceof Error?error.message:'Unable to send reset email.'); }
  return encodedRedirect('success','/forgot-password','If an account exists, a reset link has been sent.');
}
export async function resendConfirmationAction(email:string) {
  try { await authRequestThrottle(); await requestEmailToken(email,'verify'); return {success:true}; }
  catch(error) { return {success:false,error:error instanceof Error?error.message:'Unable to send confirmation email.'}; }
}
export async function resetPasswordAction(form:FormData) {
  try {
    await authRequestThrottle();
    const password=String(form.get('password')||'');
    if(password!==form.get('confirmPassword')) throw new Error('Passwords must match.');
    const jar=await cookies();
    await resetPassword(jar.get('onefin-reset')?.value||'',password);
    jar.delete('onefin-reset');
    await destroySession();
  } catch(error) { return encodedRedirect('error','/reset-password',error instanceof Error?error.message:'Unable to reset password.'); }
  return encodedRedirect('success','/sign-in','Password updated. Please sign in again.');
}
export async function updateProfileAction(form:FormData) {
  const user=await currentUser();
  if(!user) redirect('/sign-in');
  const name=String(form.get('full_name')||'').trim();
  const username=String(form.get('username')||'').trim();
  const website=String(form.get('website')||'').trim();
  if(name.length>120) return encodedRedirect('error','/account','Name must be at most 120 characters.');
  if(username && !/^[a-zA-Z0-9_]{3,32}$/.test(username)) return encodedRedirect('error','/account','Username must be 3–32 letters, numbers, or underscores.');
  if(website) { try { const url=new URL(website); if(!['https:','http:'].includes(url.protocol)||website.length>500) throw new Error(); } catch { return encodedRedirect('error','/account','Enter a valid http or https website URL.'); } }
  try { await query('update profiles set full_name=$1,username=$2,website=$3,updated_at=now() where id=$4',[name,username||null,website||null,user.id]); }
  catch { return encodedRedirect('error','/account','Unable to save profile. The username may already be taken.'); }
  revalidatePath('/account');
  return encodedRedirect('success','/account','Profile saved.');
}
