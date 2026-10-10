import 'server-only';
import { randomUUID } from 'node:crypto';
import { query } from './db';
import { signupCredits, workspaceCreditCost } from './credit-config';
export async function ensureSignupCredits(userId:string) {
  const amount=signupCredits(); if(!amount) return;
  const [existing]=await query('select user_id from credit_buckets where reference=$1',[`signup:${userId}`]);
  if(existing?.user_id===userId) return;
  await query('select grant_credits($1,$2,$3)',[userId,`signup:${userId}`,amount]);
}
export async function reserveWorkspaceCredits(userId:string) {
  const id=randomUUID();
  await ensureSignupCredits(userId);
  try { await query('select reserve_credits($1,$2,$3)',[userId,id,workspaceCreditCost()]); }
  catch(error) { throw new Error(error instanceof Error && error.message.includes('Insufficient credits')?'Not enough Workspace credits. Add credits to continue.':'Unable to reserve Workspace credits. Please try again.'); }
  return id;
}
export async function finishWorkspaceCredits(userId:string,id:string,success:boolean) { await query('select finish_credit_usage($1,$2,$3)',[userId,id,success]); }
