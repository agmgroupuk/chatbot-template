"use client";

import { SidebarComponent } from "@/components/sidebar";
import { ThemeProvider } from "next-themes";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/lib/auth";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getSubscriptionDetails } from "@/app/actions";
import { ArrowUpRight } from "lucide-react";
import { CheckoutSuccessHandler } from "@/components/checkout-success-handler";

interface ClientLayoutProps {
  children: React.ReactNode;
}

// Define ClientLayoutContent at the top level
function ClientLayoutContent({ children }: ClientLayoutProps) {
  const [showSidebar, setShowSidebar] = useState(false);
  const [logoVisible, setLogoVisible] = useState(true);
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (isAuthenticated) {
        setIsSubscriptionLoading(true);
        try {
          const details = await getSubscriptionDetails();
          setActivePlanName(details.planName);
        } catch (error) {
          console.error("Error fetching subscription status:", error);
          setActivePlanName(null);
        } finally {
          setIsSubscriptionLoading(false);
        }
      } else {
        setActivePlanName(null);
        setIsSubscriptionLoading(false);
      }
    };

    fetchSubscriptionStatus();
  }, [isAuthenticated]);

  // Check if we're on an auth page or confirmation page
  const isAuthPage = pathname === '/sign-in' || pathname === '/sign-up' || pathname === '/pricing' || pathname === '/confirmation' || pathname?.startsWith('/confirmation');

  const toggleSidebar = () => {
    if (showSidebar) {
      setShowSidebar(false);
      setTimeout(() => {
        setLogoVisible(true);
      }, 300);
    } else {
      setLogoVisible(false);
      setTimeout(() => {
        setShowSidebar(true);
      }, 200);
    }
  };

  // If we're on an auth page or confirmation page, render just the content without sidebar and header
  if (isAuthPage) {
    return (
      <div className="flex h-screen w-full overflow-y-auto bg-white text-stone-900">
        {children}
      </div>
    );
  }

  // Regular layout with sidebar for non-auth pages
  return (
    <ThemeProvider 
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
    >
      <CheckoutSuccessHandler />
      <div className="h-[calc(100vh-0px)] flex">
        <SidebarComponent
          onToggleCollapse={toggleSidebar}
          isAuthenticated={isAuthenticated}
          collapsed={!showSidebar}
          activePlanName={activePlanName}
          isSubscriptionLoading={isSubscriptionLoading}
        />
        <main className="w-full flex-1 relative">
          <header 
            className="sticky top-0 z-10 py-6 px-10 flex items-center justify-between flex-shrink-0" 
          >
            <div className="flex items-center gap-3">
              {/* Logo with menu button - conditional rendering based on logoVisible */}
              {logoVisible && (
                <div className="flex items-center justify-start gap-3 h-[26px]">
                  <div 
                    onClick={toggleSidebar} 
                    className="cursor-pointer transition-transform hover:scale-110 duration-200"
                  >
                    {/* Custom hamburger with thinner lines */}
                    <div className="flex flex-col justify-center gap-1 w-4 h-4">
                      <div className="w-4 h-[1px] bg-zinc-800 rounded-full"></div>
                      <div className="w-4 h-[1px] bg-zinc-800 rounded-full"></div>
                      <div className="w-4 h-[1px] bg-zinc-800 rounded-full"></div>
                    </div>
                  </div>
                  <span 
                    className={`font-bold text-2xl text-zinc-900 transition-all duration-200 ease-in-out ${
                      logoVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                    }`}
                    style={{ 
                      lineHeight: '26px', 
                      marginTop: '-3px'
                    }}
                  >start</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center">
              {/* Show Upgrade Button only when authenticated, not loading, and no active plan */}
              {isAuthenticated && !isSubscriptionLoading && !activePlanName && <Link 
                className="relative inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 bg-stone-900 text-stone-100 hover:bg-stone-800 px-4 py-2 h-10 rounded-full text-sm font-medium shadow-none"
                href="/pricing"
              >
                Upgrade 
                <ArrowUpRight className="h-4 w-4" />
              </Link>}

              {/* Only show Login/Signup if not authenticated */}
              {!isAuthenticated && (
                <div className="flex items-center gap-4">
                  <Link href="/sign-up">
                    <button 
                      className="relative inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 hover:bg-stone-100 text-stone-900 active:bg-stone-200 px-4 py-2 h-10 rounded-full text-sm font-medium shadow-none"
                    >
                      Sign up
                    </button>
                  </Link>
                  <Link href="/sign-in">
                    <Button 
                      className="relative inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 bg-stone-900 text-stone-100 hover:bg-stone-800 px-4 py-2 h-10 rounded-full text-sm font-medium shadow-none" 
                    >
                      Log in
                    </Button>
                  </Link>
                </div>
              )}
              {/* If authenticated, show nothing here - handled by sidebar profile */}
            </div>
          </header>
          <div 
            className="absolute inset-0 overflow-y-auto bg-transparent px-6 pt-28"
          >
             {children} 
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}

// ClientLayout now wraps ClientLayoutContent with AuthProvider
export function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <AuthProvider>
      <ClientLayoutContent>{children}</ClientLayoutContent>
    </AuthProvider>
  );
} 