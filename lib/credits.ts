import 'server-only';
import { randomUUID } from 'node:crypto';
import { query } from './db';
import { chatCreditCost, signupCredits } from './credit-config';
export async function ensureSignupCredits(userId:string) {
  const amount=signupCredits(); if(!amount) return;
  const [existing]=await query('select user_id from credit_buckets where reference=$1',[`signup:${userId}`]);
  if(existing?.user_id===userId) return;
  await query('select grant_credits($1,$2,$3)',[userId,`signup:${userId}`,amount]);
}
export async function reserveChatCredits(userId:string) {
  await ensureSignupCredits(userId);
  const id=randomUUID();
  try { await query('select reserve_credits($1,$2,$3)',[userId,id,chatCreditCost()]); }
  catch(error) { throw new Error(error instanceof Error && error.message.includes('Insufficient credits')?'Not enough credits. Choose a plan or buy a credit pack.':'Unable to reserve credits. Please try again.'); }
  return id;
}
export async function finishChatCredits(userId:string,id:string,success:boolean) { await query('select finish_credit_usage($1,$2,$3)',[userId,id,success]); }
