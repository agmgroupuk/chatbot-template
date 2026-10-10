import test from 'node:test';
import assert from 'node:assert/strict';

/** Mirrors lib/domain-routing.ts for unit coverage without a TS loader. */
function hostnameOf(value) {
  const raw = value.split(',')[0]?.trim() || '';
  if (!raw) return '';
  try {
    if (raw.includes('://')) return new URL(raw).hostname.toLowerCase();
  } catch {
    /* fall through */
  }
  return raw.split(':')[0].toLowerCase();
}

function originHostname(origin) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isCheckoutPath(pathname) {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return path === '/subscribe' || path.startsWith('/subscribe/') || path === '/checkout' || path.startsWith('/checkout/');
}

function isSharedInfrastructurePath(pathname) {
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

function resolveDomainRedirect(input) {
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

const site = 'https://onefinsolution.online';
const checkout = 'https://pay.onefinsolution.online';

test('checkout host only allows checkout paths; everything else returns to main site', () => {
  assert.equal(isCheckoutPath('/subscribe'), true);
  assert.equal(isCheckoutPath('/checkout/credits'), true);
  assert.equal(isCheckoutPath('/workspace'), false);
  assert.equal(isCheckoutPath('/'), false);

  assert.equal(
    resolveDomainRedirect({ host: 'pay.onefinsolution.online', pathname: '/workspace', siteOrigin: site, checkoutOrigin: checkout }),
    'https://onefinsolution.online/workspace',
  );
  assert.equal(
    resolveDomainRedirect({ host: 'pay.onefinsolution.online', pathname: '/', search: '?x=1', siteOrigin: site, checkoutOrigin: checkout }),
    'https://onefinsolution.online/?x=1',
  );
  assert.equal(
    resolveDomainRedirect({ host: 'pay.onefinsolution.online', pathname: '/pricing', siteOrigin: site, checkoutOrigin: checkout }),
    'https://onefinsolution.online/pricing',
  );
  assert.equal(
    resolveDomainRedirect({
      host: 'pay.onefinsolution.online',
      pathname: '/subscribe',
      search: '?plan=daily&mode=trial',
      siteOrigin: site,
      checkoutOrigin: checkout,
    }),
    null,
  );
  assert.equal(
    resolveDomainRedirect({ host: 'pay.onefinsolution.online', pathname: '/checkout/credits', siteOrigin: site, checkoutOrigin: checkout }),
    null,
  );
  assert.equal(
    resolveDomainRedirect({ host: 'pay.onefinsolution.online', pathname: '/api/health', siteOrigin: site, checkoutOrigin: checkout }),
    null,
  );
});

test('main host sends checkout paths to the payment subdomain', () => {
  assert.equal(
    resolveDomainRedirect({
      host: 'onefinsolution.online',
      pathname: '/subscribe',
      search: '?plan=monthly&mode=paid',
      siteOrigin: site,
      checkoutOrigin: checkout,
    }),
    'https://pay.onefinsolution.online/subscribe?plan=monthly&mode=paid',
  );
  assert.equal(
    resolveDomainRedirect({ host: 'onefinsolution.online', pathname: '/checkout/card', siteOrigin: site, checkoutOrigin: checkout }),
    'https://pay.onefinsolution.online/checkout/card',
  );
  assert.equal(
    resolveDomainRedirect({ host: 'onefinsolution.online', pathname: '/workspace', siteOrigin: site, checkoutOrigin: checkout }),
    null,
  );
  assert.equal(
    resolveDomainRedirect({ host: 'onefinsolution.online', pathname: '/pricing', siteOrigin: site, checkoutOrigin: checkout }),
    null,
  );
});
