import { currentUser } from '@/lib/session';
import { readPreferences } from '@/lib/account-service';
import { defaultPreferences } from '@/lib/account-preferences';

export async function GET() {
  const user = await currentUser();
  return Response.json({
    isAuthenticated: Boolean(user),
    preferences: user ? await readPreferences(user.id) : defaultPreferences,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
