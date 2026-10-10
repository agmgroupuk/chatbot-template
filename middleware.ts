import { NextRequest, NextResponse } from 'next/server';
import { authRedirect } from '@/lib/auth-redirect';
import { resolveDomainRedirect } from '@/lib/domain-routing';
import { legacySessionCookie, sessionCookie, sessionCookieOptions } from '@/lib/session-cookie';

function configuredOrigin(name: 'NEXT_PUBLIC_SITE_URL' | 'NEXT_PUBLIC_CHECKOUT_URL'): string {
  const value = process.env[name];
  if (value) return new URL(value).origin;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is required in production.`);
  }
  return 'http://localhost:3000';
}

export function middleware(request: NextRequest) {
  const siteOrigin = configuredOrigin('NEXT_PUBLIC_SITE_URL');
  const checkoutOrigin =
    process.env.NEXT_PUBLIC_CHECKOUT_URL != null && process.env.NEXT_PUBLIC_CHECKOUT_URL !== ''
      ? configuredOrigin('NEXT_PUBLIC_CHECKOUT_URL')
      : siteOrigin;

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const domainTarget = resolveDomainRedirect({
    host,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    siteOrigin,
    checkoutOrigin,
  });
  if (domainTarget) {
    return NextResponse.redirect(domainTarget, 308);
  }

  const token = request.cookies.get(sessionCookie)?.value;
  const legacyToken = legacySessionCookie ? request.cookies.get(legacySessionCookie)?.value : undefined;
  const present = Boolean(token || legacyToken);
  // Redirect authenticated visitors only after server-side session verification, not on cookie presence.
  const destination = present ? null : authRedirect(request.nextUrl.pathname, false);
  const response = destination ? NextResponse.redirect(new URL(destination, request.url)) : NextResponse.next();
  if (!token && legacyToken) response.cookies.set(sessionCookie, legacyToken, sessionCookieOptions(30 * 86400));
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
