import { createUpdateClient } from "@/utils/update/server";
import { createSupabaseClient } from '@/utils/supabase/server';

export async function POST() {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Please sign in.' }, { status: 401 });
  const client = await createUpdateClient();
  const { data, error } = await client.entitlements.check("premium");

  if (error) {
    return Response.json({ error: 'Unable to verify subscription.' }, { status: 503 });
  }

  if (!data.hasAccess) {
    return new Response("Subscription not active", { status: 403 });
  }

  try {
    const response = await fetch("https://api.thecatapi.com/v1/images/search", { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Upstream request failed');
    return Response.json(await response.json());
  } catch {
    return Response.json({ error: 'Image service is temporarily unavailable.' }, { status: 502 });
  }
}
