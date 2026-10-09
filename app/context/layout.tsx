import {currentUser} from '@/lib/session';
import {redirect} from 'next/navigation';
export default async function Layout({children}:{children:React.ReactNode}) {
 if(!await currentUser()) redirect('/sign-in');
 return children;
}
