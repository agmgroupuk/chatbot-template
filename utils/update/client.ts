import { createSupabaseClient } from "@/utils/supabase/client";
import { createClient } from "@updatedev/js";
import { billingEnvironment } from '@/lib/billing-environment';

export function createUpdateClient() {
  return createClient(process.env.NEXT_PUBLIC_UPDATE_PUBLISHABLE_KEY!, {
    getSessionToken: async () => {
      const supabase = createSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (data.session == null) return;
      return data.session.access_token;
    },
    environment: billingEnvironment(),
  });
}
