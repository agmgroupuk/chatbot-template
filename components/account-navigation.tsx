'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/account', label: 'Workspace setup' },
  { href: '/account/preferences', label: 'Preferences' },
  { href: '/account/plugins', label: 'Workspace tools' },
  { href: '/workspace', label: 'Open Workspace' },
  { href: '/dashboard/billing', label: 'Plans & billing' },
];

export function AccountNavigation() {
  const path = usePathname();
  return (
    <nav className="account-menu" aria-label="Workspace account">
      {items.map(({ href, label }) => {
        const active = path === href || (href !== '/account' && path.startsWith(href));
        return (
          <Link key={href} href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
