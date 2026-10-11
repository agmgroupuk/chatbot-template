import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { readPreferences } from '@/lib/account-service';
import { savePreferencesAction } from '@/app/account-actions';
import { SubmitButton } from '@/components/submit-button';

export const metadata = {
  title: 'Workspace preferences',
  robots: { index: false, follow: false },
};

export default async function AccountPreferencesPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  const preferences = await readPreferences(user.id);

  return (
    <section className="panel stack">
      <div>
        <h2>Workspace preferences</h2>
        <p className="muted">Theme, timezone, and editor behavior for this Workspace account.</p>
      </div>
      <form action={savePreferencesAction} className="stack">
        <label className="field">
          <span>Theme</span>
          <select name="theme" defaultValue={preferences.theme}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="field">
          <span>Time zone</span>
          <input name="timezone" defaultValue={preferences.timezone} placeholder="Asia/Bangkok" />
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="enter_to_send" defaultChecked={preferences.enter_to_send} />
          Press Enter to send messages
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="spellcheck" defaultChecked={preferences.spellcheck} />
          Enable spellcheck
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="context_enabled" defaultChecked={preferences.context_enabled} />
          Keep conversation context enabled
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="product_updates" defaultChecked={preferences.product_updates} />
          Product update emails
        </label>
        <div className="button-row">
          <SubmitButton>Save preferences</SubmitButton>
        </div>
      </form>
    </section>
  );
}
