export function authRedirect(path: string, authenticated: boolean): string | null {
  const protectedPage = ['/account', '/dashboard', '/chat', '/context', '/c', '/protected', '/workspace'].some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  if (!authenticated && protectedPage) {
    return path === '/workspace' || path.startsWith('/workspace/')
      ? `/sign-in?next=${encodeURIComponent(path)}`
      : '/sign-in';
  }
  if (authenticated && ['/sign-in', '/sign-up'].includes(path)) return '/';
  return null;
}
