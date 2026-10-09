import { createClient } from "@updatedev/js";
import { createSupabaseClient } from "../supabase/server";
import { billingEnvironment } from '@/lib/billing-environment';
import { createStripeBilling } from '@/lib/stripe-billing';

export async function createUpdateClient() {
  billingEnvironment();
  if (process.env.BILLING_PROVIDER === 'stripe') {
    const billing = createStripeBilling();
    return { billing, entitlements: {
      async check() {
        const result = await billing.getSubscriptions();
        return { data: { hasAccess: result.data.subscriptions?.some(sub => sub.status === 'active') || false }, error: result.error };
      },
    } };
  }
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      const supabase = await createSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (data.session == null) return;
      return data.session.access_token;
    },
    environment: billingEnvironment(),
  });
}
