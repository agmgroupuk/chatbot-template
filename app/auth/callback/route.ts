import { createSupabaseClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  
  if (code) {
    const client = await createSupabaseClient();
    await client.auth.exchangeCodeForSession(code);
  }

  // Revalidate the root path to refresh client state
  revalidatePath("/");

  // Redirect to home page after successful confirmation
  return NextResponse.redirect(new URL("/", request.url));
} 