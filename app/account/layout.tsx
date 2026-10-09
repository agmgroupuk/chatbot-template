import { currentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/page-heading';
import { AccountNavigation } from '@/components/account-navigation';
export const metadata={title:'Profile & Settings | One Fin Solution',robots:{index:false,follow:false}};
export default async function AccountLayout({children}:{children:React.ReactNode}) {
  if(!await currentUser()) redirect('/sign-in');
  return <div className="page-wrap"><PageHeading eyebrow="YOUR ACCOUNT" title="Make yourself at home." description="Keep your details up to date and set up your workspace the way you like it." /><div className="account-grid"><AccountNavigation /><div className="stack">{children}</div></div></div>;
}
