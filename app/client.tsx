'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeProvider } from 'next-themes';
import { SidebarComponent } from '@/components/sidebar';
import { SiteFooter, SiteHeader } from '@/components/site-navigation';
import { AuthProvider, useAuth } from '@/lib/auth';
import { getSubscriptionDetails } from '@/app/actions';
import { CheckoutSuccessHandler } from '@/components/checkout-success-handler';

interface ClientLayoutProps {
  children: React.ReactNode;
}

function ClientLayoutContent({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const isHomePage = pathname === '/';
  const isWorkspacePage = pathname === '/workspace';
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (!isHomePage || !isAuthenticated) {
      setActivePlanName(null);
      setIsSubscriptionLoading(false);
      return () => {
        active = false;
      };
    }

    setIsSubscriptionLoading(true);
    getSubscriptionDetails()
      .then((details) => {
        if (active) setActivePlanName(details.planName);
      })
      .catch((error: unknown) => {
        console.error('Error fetching subscription status:', error);
        if (active) setActivePlanName(null);
      })
      .finally(() => {
        if (active) setIsSubscriptionLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, isHomePage]);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      <CheckoutSuccessHandler />
      {isHomePage ? (
        <div className="home-chat-shell">
          <SidebarComponent
            className={`home-chat-sidebar${isMobileSidebarOpen ? ' is-mobile-open' : ''}`}
            isAuthenticated={isAuthenticated}
            collapsed={false}
            activePlanName={activePlanName}
            isSubscriptionLoading={isSubscriptionLoading}
          />
          {isMobileSidebarOpen && (
            <button
              className="home-chat-backdrop"
              type="button"
              aria-label="Close workspace menu"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
          )}
          <main className="home-chat-main">
            <button
              className="home-chat-menu"
              type="button"
              aria-label="Open chat menu"
              aria-expanded={isMobileSidebarOpen}
              onClick={() => setIsMobileSidebarOpen((open) => !open)}
            >
              <span /><span /><span />
            </button>
            {children}
          </main>
        </div>
      ) : isWorkspacePage ? (
        <div className="workspace-route-shell">{children}</div>
      ) : (
        <div className="site-shell">
          <a className="skip-link" href="#main-content">Skip to content</a>
          <SiteHeader />
          <main id="main-content" className={`site-main${pathname.startsWith('/c/') ? ' chat-conversation-main' : ''}`}>
            {children}
          </main>
          <SiteFooter />
        </div>
      )}
    </ThemeProvider>
  );
}

export function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <AuthProvider>
      <ClientLayoutContent>{children}</ClientLayoutContent>
    </AuthProvider>
  );
}
