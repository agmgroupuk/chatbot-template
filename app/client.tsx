'use client';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider, useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState,useEffect } from 'react';
import { getPreferencesAction } from '@/app/account-actions';
import { Menu, X, ArrowUpRight, Sparkles } from 'lucide-react';
const navigation = [['/pricing', 'Pricing'], ['/about', 'About us'], ['/support', 'Help center'], ['/contact', 'Contact']] as const;
function SiteLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const {setTheme}=useTheme();
  useEffect(()=>{let active=true;if(isAuthenticated)getPreferencesAction().then(settings=>{if(active)setTheme(settings.theme);}).catch(()=>{});return ()=>{active=false;};},[isAuthenticated,setTheme]);
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return <div className="site-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header"><Link href="/" className="site-brand" aria-label="One Fin home"><span className="brand-mark"><Sparkles size={19} /></span>One Fin<span className="brand-sub">SOLUTION</span></Link>
      <nav aria-label="Main navigation" className="desktop-nav">{navigation.map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>{label}</Link>)}</nav>
      <div className="header-actions">{!isLoading && (isAuthenticated ? <Link className="button small" href="/dashboard">Dashboard <ArrowUpRight size={15} /></Link> : <><Link className="desktop-signin" href="/sign-in">Sign in</Link><Link className="button small" href="/sign-up">Get started <ArrowUpRight size={15} /></Link></>)}<button className="mobile-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div>
    </header>
    {open && <nav aria-label="Mobile navigation" className="mobile-nav">{[...navigation, ['/dashboard', 'Dashboard'], ['/account', 'Profile & settings'], ['/sign-in', 'Sign in']].map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}</nav>}
    {isAuthenticated && <nav className="workspace-nav" aria-label="Your workspace">{[['/dashboard','Overview'],['/chat','New chat'],['/context','Saved context'],['/account','Profile & settings'],['/dashboard/support','My requests']].map(([href,label]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>{label}</Link>)}</nav>}
    <main id="main-content" className="site-main" tabIndex={-1}>{children}</main>
    <footer className="site-footer"><div className="footer-top"><div><Link href="/" className="site-brand">One Fin Solution</Link><p>Thoughtful software. A workspace that works for you.</p><p className="small-copy">ONE FIN SOLUTION COMPANY LIMITED<br />Registration 0115569007686</p></div><div className="footer-links"><div><strong>Explore</strong><Link href="/about">About us</Link><Link href="/pricing">Pricing</Link><Link href="/dashboard">Dashboard</Link></div><div><strong>Help</strong><Link href="/support">Support / Help Center</Link><Link href="/contact">Contact us</Link><Link href="/forgot-password">Password recovery</Link></div><div><strong>Legal</strong><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms & Conditions</Link><Link href="/payment-policy">Payment, Cancellation & Refund Policy</Link></div></div></div><div className="footer-bottom">© {new Date().getUTCFullYear()} One Fin Solution.<span>Built for your everyday work.</span></div></footer>
  </div>;
}
export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem><AuthProvider><SiteLayout>{children}</SiteLayout></AuthProvider></ThemeProvider>;
}
