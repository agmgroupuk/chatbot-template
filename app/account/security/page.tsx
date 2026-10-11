import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';

export const metadata = {
  title: 'Security',
  robots: { index: false, follow: false },
};

export default async function AccountSecurityRedirectPage() {
  if (!(await currentUser())) redirect('/sign-in');
  return (
    <section className="panel stack">
      <h2>Password & security</h2>
      <p className="muted">
        Password changes and security controls now live inside the Settings popup under <strong>Account</strong>, so they stay with your
        personal account dashboard instead of Workspace setup.
      </p>
      <div className="button-row">
        <Link className="button" href="/">
          Open chat & Settings
        </Link>
        <Link className="button secondary" href="/account">
          Back to Workspace setup
        </Link>
      </div>
    </section>
  );
}
