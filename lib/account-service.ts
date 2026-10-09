import 'server-only';
import { query, transaction, ownedQuery } from './db';
import { hashPassword, verifyPassword } from './password';
import { defaultPreferences, type AccountPreferences } from './account-preferences';
export async function readPreferences(userId:string):Promise<AccountPreferences> {
  const [settings]=await ownedQuery(userId,'select theme,timezone,enter_to_send,spellcheck,context_enabled,product_updates from account_settings where user_id=$1',[userId]);
  return settings ? {...defaultPreferences,...settings} : {...defaultPreferences};
}
export async function savePreferences(userId:string,settings:AccountPreferences) {
  await ownedQuery(userId,`insert into account_settings(user_id,theme,timezone,enter_to_send,spellcheck,context_enabled,product_updates) values($1,$2,$3,$4,$5,$6,$7)
    on conflict(user_id) do update set theme=excluded.theme,timezone=excluded.timezone,enter_to_send=excluded.enter_to_send,spellcheck=excluded.spellcheck,context_enabled=excluded.context_enabled,product_updates=excluded.product_updates,updated_at=now()`,[userId,settings.theme,settings.timezone,settings.enter_to_send,settings.spellcheck,settings.context_enabled,settings.product_updates]);
}
export async function changePassword(userId:string,currentPassword:string,newPassword:string) {
  const nextHash=await hashPassword(newPassword);
  await transaction(async client=>{
    const {rows}=await client.query('select password_hash from app_users where id=$1 for update',[userId]);
    if(!rows[0] || !await verifyPassword(currentPassword,rows[0].password_hash)) throw new Error('Your current password is incorrect.');
    if(await verifyPassword(newPassword,rows[0].password_hash)) throw new Error('Choose a different new password.');
    await client.query('update app_users set password_hash=$1 where id=$2',[nextHash,userId]);
    await client.query('delete from app_sessions where user_id=$1',[userId]);
    await client.query("delete from auth_tokens where user_id=$1 and purpose='reset'",[userId]);
  });
}
export async function revokeOtherSessions(userId:string,currentHash:string,targetCreatedAt?:string) {
  if(!/^[a-f0-9]{64}$/.test(currentHash)) throw new Error('Please sign in again.');
  if(targetCreatedAt) {
    if(Number.isNaN(Date.parse(targetCreatedAt))) throw new Error('Invalid session.');
    await query('delete from app_sessions where user_id=$1 and token_hash<>$2 and created_at=$3::timestamptz',[userId,currentHash,targetCreatedAt]);
  } else await query('delete from app_sessions where user_id=$1 and token_hash<>$2',[userId,currentHash]);
}
