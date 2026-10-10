const production = process.env.NODE_ENV === 'production';
const configuredDomain = process.env.SESSION_COOKIE_DOMAIN || '.onefinsolution.online';
if (production && configuredDomain !== '.onefinsolution.online' && configuredDomain !== 'localhost') {
  throw new Error('SESSION_COOKIE_DOMAIN must be .onefinsolution.online.');
}
const domain = production ? configuredDomain : undefined;

export const sessionCookie = production ? '__Secure-onefin-session' : 'onefin-session';
export const legacySessionCookie = production ? '__Host-onefin-session' : null;

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    ...(domain ? { domain } : {}),
  };
}
