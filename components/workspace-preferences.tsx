'use client';
import { useEffect,useState } from 'react';
import { getPreferencesAction } from '@/app/account-actions';
import { defaultPreferences } from '@/lib/account-preferences';
import { useAuth } from '@/lib/auth';
export function useWorkspacePreferences() {
  const [preferences,setPreferences]=useState(defaultPreferences);
  const {isAuthenticated}=useAuth();
  useEffect(()=>{let active=true;if(isAuthenticated) getPreferencesAction().then(value=>{if(active)setPreferences(value);}).catch(()=>{});return ()=>{active=false;};},[isAuthenticated]);
  return preferences;
}
