import { currentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { IdeInterfaceComponent } from '@/components/ide-interface';
export default async function ChatPage() {
  if (!await currentUser()) redirect('/sign-in');
  return <div className="page-wrap"><IdeInterfaceComponent /></div>;
}
