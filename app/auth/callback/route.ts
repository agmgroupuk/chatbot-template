import { createSupabaseClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { siteUrl } from '@/lib/site-url';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next');
  const destination = next === '/reset-password' ? next : '/';
  if (code) {
    const client = await createSupabaseClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, siteUrl()));
  }
  return NextResponse.redirect(new URL('/sign-in?error=Authentication%20link%20is%20invalid%20or%20expired.', siteUrl()));
}
