import { currentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/page-heading';
import { AccountNavigation } from '@/components/account-navigation';

export const metadata = {
  title: 'Workspace',
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  if (!(await currentUser())) redirect('/sign-in');
  return (
    <div className="page-wrap">
      <PageHeading
        eyebrow="Account area"
        title="Workspace setup"
        description="Workspace-only configuration, credits, and preferences. Personal account settings stay inside the Settings popup."
      />
      <div className="account-shell">
        <AccountNavigation />
        <div className="stack">{children}</div>
      </div>
    </div>
  );
}
