const production = process.env.NODE_ENV === 'production';
const configuredDomain = process.env.SESSION_COOKIE_DOMAIN;
// Single-domain app: host-only cookies by default. Optional domain for apex/www sharing only.
if (
  production &&
  configuredDomain &&
  configuredDomain !== 'onefinsolution.online' &&
  configuredDomain !== '.onefinsolution.online' &&
  configuredDomain !== 'localhost'
) {
  throw new Error('SESSION_COOKIE_DOMAIN must be onefinsolution.online when set.');
}
const domain = production && configuredDomain && configuredDomain !== 'localhost' ? configuredDomain : undefined;

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
