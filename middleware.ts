import { NextRequest, NextResponse } from 'next/server';
import { authRedirect } from '@/lib/auth-redirect';
// Cookie presence is only a routing hint. Every private page/action verifies the database session.
export function middleware(request:NextRequest) {
  const present=Boolean(request.cookies.get(process.env.NODE_ENV==='production'?'__Host-onefin-session':'onefin-session')?.value);
  // Redirect authenticated visitors only after server-side session verification, not on cookie presence.
  const destination=present?null:authRedirect(request.nextUrl.pathname,false);
  const response=destination?NextResponse.redirect(new URL(destination,request.url)):NextResponse.next();
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
