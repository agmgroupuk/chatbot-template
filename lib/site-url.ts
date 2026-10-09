export function siteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) {
    if (process.env.NODE_ENV === 'production') throw new Error('NEXT_PUBLIC_SITE_URL is required in production.');
    return 'http://localhost:3000';
  }
  const url = new URL(value);
  if (process.env.NODE_ENV === 'production' && (url.protocol !== 'https:' || /^(localhost|127\.0\.0\.1)$/.test(url.hostname))) {
    throw new Error('NEXT_PUBLIC_SITE_URL must be the public HTTPS domain.');
  }
  return url.origin;
}
