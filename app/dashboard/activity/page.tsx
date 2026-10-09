import Link from 'next/link';
import { currentUser } from '@/lib/session';
import { ownedQuery } from '@/lib/db';
import { readPreferences } from '@/lib/account-service';
import { accountDate } from '@/lib/dashboard';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/page-heading';
import { ConversationList } from '@/components/conversation-list';
export default async function Activity() {
  const user=await currentUser();if(!user) redirect('/sign-in');
  const [chats,settings]=await Promise.all([ownedQuery(user.id,'select id,name,updated_at::text from chats where user_id=$1 order by updated_at desc',[user.id]),readPreferences(user.id)]);
  return <div className="page-wrap"><PageHeading eyebrow="DASHBOARD / ACTIVITY" title="Pick up where you left off." description="Search, reopen, or delete your saved conversations." /><div className="button-row"><Link className="button" href="/chat">New conversation</Link><Link className="text-link" href="/dashboard">Back to dashboard</Link></div><div className="panel"><ConversationList chats={chats.map(chat=>({id:chat.id,name:chat.name,updated:accountDate(chat.updated_at,settings.timezone)}))} /></div></div>;
}
