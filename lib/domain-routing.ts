/** Pure host/path rules for main site vs checkout subdomain. */

export type DomainRedirectInput = {
  host: string;
  pathname: string;
  search?: string;
  siteOrigin: string;
  checkoutOrigin: string;
};

function hostnameOf(value: string): string {
  const raw = value.split(',')[0]?.trim() || '';
  if (!raw) return '';
  try {
    if (raw.includes('://')) return new URL(raw).hostname.toLowerCase();
  } catch {
    /* fall through */
  }
  return raw.split(':')[0].toLowerCase();
}

export function originHostname(origin: string): string {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Paths that may render on the checkout subdomain. */
export function isCheckoutPath(pathname: string): boolean {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return path === '/subscribe' || path.startsWith('/subscribe/') || path === '/checkout' || path.startsWith('/checkout/');
}

/** Next assets, health, and API must work on both hosts. */
export function isSharedInfrastructurePath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname === '/api' ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    /\.(?:ico|png|jpg|jpeg|gif|svg|webp|txt|xml|js|css|map|woff2?)$/i.test(pathname)
  );
}

/**
 * Returns an absolute redirect URL when the request is on the wrong host for
 * the path, otherwise null (continue on the current host).
 */
export function resolveDomainRedirect(input: DomainRedirectInput): string | null {
  const host = hostnameOf(input.host);
  if (!host) return null;

  const siteHost = originHostname(input.siteOrigin);
  const checkoutHost = originHostname(input.checkoutOrigin);
  if (!siteHost || !checkoutHost || siteHost === checkoutHost) return null;

  const path = input.pathname || '/';
  const search = input.search || '';
  const onCheckout = host === checkoutHost;
  const onSite = host === siteHost;

  if (!onCheckout && !onSite) return null;
  if (isSharedInfrastructurePath(path)) return null;

  if (onCheckout && !isCheckoutPath(path)) {
    return `${input.siteOrigin.replace(/\/$/, '')}${path}${search}`;
  }

  if (onSite && isCheckoutPath(path)) {
    return `${input.checkoutOrigin.replace(/\/$/, '')}${path}${search}`;
  }

  return null;
}

export function absoluteSitePath(siteOrigin: string, path: string): string {
  const base = siteOrigin.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function absoluteCheckoutPath(checkoutOrigin: string, path: string): string {
  const base = checkoutOrigin.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
