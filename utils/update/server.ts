import { createClient } from "@updatedev/js";
import { createSupabaseClient } from "../supabase/server";
import { billingEnvironment } from '@/lib/billing-environment';

export async function createUpdateClient() {
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
