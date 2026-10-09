"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createUpdateClient } from "@/utils/update/client";

export function CheckoutSuccessHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    
    if (checkoutStatus === 'success' && !synced) {
      // Set synced to true to prevent multiple executions
      setSynced(true);
      
      const syncSubscription = async () => {
        try {
          // Use the update client to sync subscription data
          const client = createUpdateClient();
          // Refresh subscription data
          await client.billing.getSubscriptions();
          
          // Clean up URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Refresh the page to show updated UI
          router.refresh();
          console.log("Subscription synced with Update Client after successful checkout");
        } catch (error) {
          console.error("Error syncing subscription data:", error);
        }
      };
      
      syncSubscription();
    }
  }, [searchParams, synced, router]);

  // This is a utility component with no UI
  return null;
} 