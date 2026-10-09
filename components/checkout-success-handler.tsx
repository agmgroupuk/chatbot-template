"use client";
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { checkoutStatusAction } from '@/app/billing-actions';

export function CheckoutSuccessHandler() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    if (params.get('checkout') !== 'success') return;
    let cancelled = false;
    const session = params.get('session_id');
    async function reconcile() {
      for (let attempt = 0; attempt < 6 && !cancelled; attempt++) {
        try {
          if (!session || await checkoutStatusAction(session) === 'paid') {
            if (cancelled) return;
            const url = new URL(window.location.href);
            url.searchParams.delete('checkout');
            url.searchParams.delete('session_id');
            window.history.replaceState({}, '', url.pathname + url.search);
            router.refresh();
            return;
          }
        } catch {
          // Keep the processing message and URL for a later refresh/retry.
        }
        await new Promise(resolve => setTimeout(resolve,2000));
      }
    }
    void reconcile();
    return () => { cancelled = true; };
  },[params,router]);
  return null;
}
