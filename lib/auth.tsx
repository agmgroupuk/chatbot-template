'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createSupabaseClient } from "@/utils/supabase/client";
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const checkSession = async () => {
    const client = createSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    setIsAuthenticated(!!session);
  };

  useEffect(() => {
    // Check session when component mounts and pathname changes
    checkSession();
    
    // Check if there's a successful checkout
    const searchParams = new URLSearchParams(window.location.search);
    const checkoutStatus = searchParams.get('checkout');
    
    if (checkoutStatus === 'success') {
      // Clear the URL parameter to prevent repeated processing
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Refresh subscription data
      const refreshSubscription = async () => {
        try {
          const client = createSupabaseClient();
          const { data } = await client.auth.getSession();
          if (data.session) {
            // Trigger a server-side revalidation to update subscription data
            router.refresh();
            console.log("Subscription data refreshed after successful checkout");
          }
        } catch (error) {
          console.error("Error refreshing subscription data:", error);
        }
      };
      
      refreshSubscription();
    }
  }, [pathname]);

  useEffect(() => {
    const client = createSupabaseClient();
    
    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = () => setIsAuthenticated(true);
  const logout = () => setIsAuthenticated(false);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 