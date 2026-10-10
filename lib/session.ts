import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { query } from './db';
import { randomToken, tokenHash } from './password';
export const sessionCookie = process.env.NODE_ENV === 'production' ? '__Host-onefin-session' : 'onefin-session';
export type User = { id: string; email: string; email_verified_at: string | null };
export async function userFromToken(token?: string): Promise<User | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [user] = await query<User>(`select u.id,u.email,u.email_verified_at from app_sessions s join app_users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now()`,[tokenHash(token)]);
  return user || null;
}
export const currentUser = cache(async () => userFromToken((await cookies()).get(sessionCookie)?.value));
export async function createSession(userId: string) {
  const token = randomToken();
  await query("insert into app_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '30 days')",[tokenHash(token),userId]);
  (await cookies()).set(sessionCookie,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:30*86400});
}
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await query('delete from app_sessions where token_hash=$1',[tokenHash(token)]);
  // __Host- cookies require Secure even on an expiry/deletion response.
  jar.set(sessionCookie,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
}
