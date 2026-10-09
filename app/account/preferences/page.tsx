import { currentUser } from '@/lib/session';
import { readPreferences } from '@/lib/account-service';
import { redirect } from 'next/navigation';
import { PreferencesForm } from '@/components/preferences-form';
import { FormNotice } from '@/components/form-notice';
export default async function Preferences({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}) {
  const user=await currentUser(); if(!user) redirect('/sign-in');
  const [settings,params]=await Promise.all([readPreferences(user.id),searchParams]);
  return <><FormNotice {...params} /><PreferencesForm settings={settings} /></>;
}
