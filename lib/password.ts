import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const options = {N:32768,r:8,p:3,maxmem:64*1024*1024};
export function tokenHash(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function randomToken() { return randomBytes(32).toString('base64url'); }
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 128) throw new Error('Use a password between 12 and 128 characters.');
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password,salt,64,options) as Buffer;
  return `scrypt-v1:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm,salt,hex] = stored.split(':');
  if (!['scrypt','scrypt-v1'].includes(algorithm) || !salt || !hex || password.length > 128) return false;
  const hash = (algorithm==='scrypt-v1' ? await scrypt(password,salt,64,options) : await scrypt(password,salt,64)) as Buffer;
  const expected = Buffer.from(hex,'hex');
  return expected.length === hash.length && timingSafeEqual(hash,expected);
}
