import { currentUser } from '@/lib/session';
import { ownedQuery } from '@/lib/db';
import { redirect } from 'next/navigation';
import { updateProfileAction } from '@/app/auth-actions';
import { signOutAction } from '@/app/actions';
import { SubmitButton } from '@/components/submit-button';
import { FormNotice } from '@/components/form-notice';
import Link from 'next/link';
export default async function Account({ searchParams }: { searchParams: Promise<{error?:string;success?:string}> }) {
  const user=await currentUser(); if(!user) redirect('/sign-in');
  const [profiles,params]=await Promise.all([ownedQuery(user.id,'select full_name,username,website from profiles where id=$1',[user.id]),searchParams]);
  const profile=profiles[0]||{};
  return <><FormNotice {...params} /><section className="panel"><div className="setting-row" style={{paddingTop:0}}><div><h2>Personal profile</h2><p>Your identity across the One Fin workspace.</p></div><span className="badge">Email verified</span></div><form action={updateProfileAction} className="stack mt-6"><div className="form-grid"><label className="field">Full name<input name="full_name" maxLength={120} defaultValue={profile.full_name||''} autoComplete="name" /></label><label className="field">Username<input name="username" minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]{3,32}" defaultValue={profile.username||''} autoComplete="username" /><small>3–32 letters, numbers, or underscores. Optional.</small></label></div><label className="field">Email address<input type="email" value={user.email} readOnly /><small>For an email change, <Link className="text-link" href="/contact?category=account&subject=Email%20change%20request">contact support</Link> so we can verify ownership.</small></label><label className="field">Website<input name="website" type="url" maxLength={500} placeholder="https://example.com" defaultValue={profile.website||''} autoComplete="url" /></label><div><SubmitButton>Save profile</SubmitButton></div></form></section><section className="panel"><h2>Account access</h2><p>Keep your profile and settings separate from your activity overview.</p><div className="button-row"><Link className="button secondary" href="/dashboard">Go to dashboard</Link><form action={signOutAction}><SubmitButton className="button secondary" pendingText="Signing out…">Sign out</SubmitButton></form></div></section></>;
}
