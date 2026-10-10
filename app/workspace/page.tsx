import { redirect } from 'next/navigation';
import { WorkspaceApplication } from '@/components/workspace-application';
import { currentUser } from '@/lib/session';
import { getWorkspaceBillingData, workspaceCreditPurchaseStatus } from '@/app/workspace-actions';

export const metadata = {
  title: 'Workspace | One Fin Solution',
  description: 'Your authenticated AI workbench, Workspace credits, and payment settings.',
  robots: { index: false, follow: false },
};

export default async function Workspace({ searchParams }: { searchParams: Promise<{ purchase?: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=%2Fworkspace');

  const params = await searchParams;
  const purchaseStatus = params.purchase ? await workspaceCreditPurchaseStatus(params.purchase) : null;
  const initialData = await getWorkspaceBillingData();

  return (
    <WorkspaceApplication
      email={user.email}
      publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
      initialData={initialData}
      paymentConfirmed={purchaseStatus?.status === 'succeeded'}
    />
  );
}
