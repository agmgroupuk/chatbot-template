'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

const navigationLinks = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/support', label: 'Help center' },
  { href: '/contact', label: 'Contact' },
];

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="site-header">
      <Link className="site-brand" href="/" onClick={closeMenu} aria-label="One Fin Solution home">
        <span className="brand-mark" aria-hidden="true">OF</span>
        <span>One Fin <span className="site-brand-light">Solution</span></span>
      </Link>

      <nav className="desktop-nav" aria-label="Main navigation">
        {navigationLinks.map(({ href, label }) => (
          <Link key={href} href={href} aria-current={isCurrentPath(pathname, href) ? 'page' : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="header-actions">
        {!isLoading && (
          isAuthenticated
            ? <Link className="button small secondary header-account-link" href="/dashboard">Dashboard</Link>
            : <Link className="header-sign-in" href="/sign-in">Sign in</Link>
        )}
        <Link className="button small" href="/workspace">Workspace</Link>
        <button
          className="mobile-toggle"
          type="button"
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-site-navigation"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span className={`menu-glyph${isMenuOpen ? ' is-open' : ''}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      {isMenuOpen && (
        <nav className="mobile-nav" id="mobile-site-navigation" aria-label="Mobile navigation">
          {navigationLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isCurrentPath(pathname, href) ? 'page' : undefined}
              onClick={closeMenu}
            >
              {label}
            </Link>
          ))}
          {!isLoading && (
            isAuthenticated
              ? <Link href="/dashboard" onClick={closeMenu}>Dashboard</Link>
              : <Link href="/sign-in" onClick={closeMenu}>Sign in</Link>
          )}
          <Link href="/workspace" onClick={closeMenu}>Workspace</Link>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <Link className="site-brand footer-brand" href="/">
            <span className="brand-mark" aria-hidden="true">OF</span>
            <span>One Fin <span className="site-brand-light">Solution</span></span>
          </Link>
          <p>Practical software and AI tools for the work ahead.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <div>
            <strong>Explore</strong>
            <Link href="/">Homepage chat</Link>
            <Link href="/pricing">Plans &amp; pricing</Link>
            <Link href="/support">Help center</Link>
          </div>
          <div>
            <strong>Company</strong>
            <Link href="/about">About us</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/dashboard">My dashboard</Link>
          </div>
          <div>
            <strong>Policies</strong>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms &amp; conditions</Link>
            <Link href="/payment-policy">Payments &amp; refunds</Link>
          </div>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} One Fin Solution. All rights reserved.</span>
        <Link href="/contact">Get in touch</Link>
      </div>
    </footer>
  );
}
