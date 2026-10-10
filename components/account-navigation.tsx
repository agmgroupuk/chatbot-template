'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export function AccountNavigation() {
  const path=usePathname();
  return <nav className="account-menu" aria-label="Account settings">{[['/account','Personal profile'],['/account/preferences','Workspace & extensions'],['/account/plugins','Plugins & models'],['/account/security','Password & security'],['/account/privacy','Data & privacy'],['/dashboard/billing','Chat plans & billing']].map(([href,label])=><Link key={href} href={href} aria-current={path===href?'page':undefined}>{label}</Link>)}</nav>;
}
