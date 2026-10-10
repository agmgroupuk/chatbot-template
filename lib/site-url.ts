import {
  absoluteCheckoutPath,
  absoluteSitePath,
  originHostname,
} from '@/lib/domain-routing';

export function siteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) {
    if (process.env.NODE_ENV === 'production') throw new Error('NEXT_PUBLIC_SITE_URL is required in production.');
    return 'http://localhost:3000';
  }
  const url = new URL(value);
  if (process.env.NODE_ENV === 'production' && originHostname(value) === 'localhost') {
    throw new Error('NEXT_PUBLIC_SITE_URL must not be localhost in production.');
  }
  return url.origin;
}

export function checkoutUrl(): string {
  const value = process.env.NEXT_PUBLIC_CHECKOUT_URL;
  if (!value) {
    if (process.env.NODE_ENV === 'production') throw new Error('NEXT_PUBLIC_CHECKOUT_URL is required in production.');
    return siteUrl();
  }
  const url = new URL(value);
  if (process.env.NODE_ENV === 'production' && originHostname(value) === 'localhost') {
    throw new Error('NEXT_PUBLIC_CHECKOUT_URL must not be localhost in production.');
  }
  return url.origin;
}

/** Public browser helpers (NEXT_PUBLIC_* only). */
export function publicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function publicCheckoutUrl(): string {
  return (process.env.NEXT_PUBLIC_CHECKOUT_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
}

export function sitePath(path: string): string {
  return absoluteSitePath(siteUrl(), path);
}

export function checkoutPath(path: string): string {
  return absoluteCheckoutPath(checkoutUrl(), path);
}

export function publicSitePath(path: string): string {
  return absoluteSitePath(publicSiteUrl(), path);
}

export function publicCheckoutPath(path: string): string {
  return absoluteCheckoutPath(publicCheckoutUrl(), path);
}
