'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createSupabaseClient } from "@/utils/supabase/client";
import { usePathname } from 'next/navigation';

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

  const checkSession = async () => {
    const client = createSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    setIsAuthenticated(!!session);
  };

  useEffect(() => {
    // Check session when component mounts and pathname changes
    checkSession();
    
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