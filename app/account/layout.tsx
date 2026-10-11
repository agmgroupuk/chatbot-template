import { currentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/page-heading';
import { AccountNavigation } from '@/components/account-navigation';
import Link from 'next/link';

export const metadata = {
  title: 'Workspace setup',
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  return (
    <div className="page-wrap">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <PageHeading
          eyebrow="WORKSPACE SETUP"
          title="Configure your Workspace."
          description="Manage Workspace preferences, tools, credits, and privacy. Personal account details, billing addresses, modules, subscriptions, and password live in the Settings popup on the chat screen."
        />
        <div className="button-row">
          <Link className="button secondary" href="/">
            Open chat & Settings
          </Link>
          <Link className="button" href="/workspace">
            Open Workspace
          </Link>
        </div>
      </div>
      <div className="account-shell">
        <AccountNavigation />
        <div className="account-main stack">{children}</div>
      </div>
    </div>
  );
}
