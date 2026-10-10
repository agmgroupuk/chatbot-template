"use client";

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { checkoutStatusAction } from '@/app/billing-actions';
import { publicSitePath } from '@/lib/site-url';

export function CheckoutSuccessHandler() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sessionId = params.get('session_id');
    if (!sessionId) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await checkoutStatusAction(sessionId);
        if (cancelled) return;
        if (result === 'paid') {
          router.replace(publicSitePath('/dashboard/billing?billing=success'));
          return;
        }
        if (result === 'pending') {
          router.replace(publicSitePath('/dashboard/billing?billing=action_required'));
          return;
        }
        router.replace(publicSitePath('/pricing?billing=failed'));
      } catch {
        if (!cancelled) router.replace(publicSitePath('/pricing?billing=failed'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return null;
}
