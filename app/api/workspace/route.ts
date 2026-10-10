import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/session';
import { throttle } from '@/lib/auth-service';
import { reserveWorkspaceCredits, finishWorkspaceCredits } from '@/lib/credits';
import { generateResponse } from '@/lib/ai';
import { query, transaction } from '@/lib/db';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET() {
  const user = await currentUser();
  if (!user) return reply({ error: 'Please sign in to open your Workspace.' }, 401);
  try {
    const [balance] = await query<{ balance: string }>('select available_credits($1)::text as balance', [user.id]);
    return reply({ signedIn: true, balance: Number(balance?.balance || 0) });
  } catch (error) {
    console.error('Unable to read Workspace credits:', error);
    return reply({ error: 'Workspace credits are temporarily unavailable.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin &&
      request.headers.get('origin') !== process.env.NEXT_PUBLIC_SITE_URL) {
    return reply({ error: 'Invalid request origin.' }, 403);
  }

  const user = await currentUser();
  if (!user) return reply({ error: 'Please sign in to use your Workspace.' }, 401);

  let reservation: string | undefined;
  try {
    if (Number(request.headers.get('content-length') || 0) > 160000) return reply({ error: 'Message is too long.' }, 413);
    const body = await request.text();
    if (body.length > 160000) return reply({ error: 'Message is too long.' }, 413);
    let input: { messages?: unknown; conversationId?: unknown };
    try {
      input = JSON.parse(body);
    } catch {
      return reply({ error: 'Enter a valid message.' }, 400);
    }
    const messages = input.messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20 ||
        messages.some((value: { sender?: unknown; content?: unknown }) =>
          !value || !['user', 'ai'].includes(String(value.sender)) ||
          typeof value.content !== 'string' || value.content.length > 32000) ||
        messages.at(-1)?.sender !== 'user') {
      return reply({ error: 'Enter a valid message.' }, 400);
    }

    const conversationId = input.conversationId;
    if (typeof conversationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(conversationId)) return reply({error:'Invalid task conversation.'},400);
    const existing = await query<{user_id:string;area:string}>('select user_id,area from chats where id=$1',[conversationId]);
    if (existing.length && (existing[0].user_id!==user.id || existing[0].area!=='workspace')) return reply({error:'Task conversation unavailable.'},404);
    const previous = await query<{id:string}>('select id from messages where chat_id=$1 and user_id=$2 order by created_at,id',[conversationId,user.id]);
    await throttle(`workspace:${user.id}`, 60);
    reservation = await reserveWorkspaceCredits(user.id);
    const answer = await generateResponse(messages as { id?: string; sender: 'user' | 'ai'; content: string }[]);
    const userMessageId=randomUUID(),answerId=randomUUID();
    const nextBalance=await transaction(async client=>{
      await client.query('select pg_advisory_xact_lock(hashtext($1))',[conversationId]);
      const {rows:current}=await client.query('select user_id,area from chats where id=$1',[conversationId]);
      if(current.length && (current[0].user_id!==user.id || current[0].area!=='workspace')) throw new Error('Conversation unavailable.');
      const {rows:now}=await client.query('select id from messages where chat_id=$1 order by created_at,id',[conversationId]);
      if(JSON.stringify(now)!==JSON.stringify(previous)) throw new Error('Conversation changed. Reopen it before retrying.');
      if(!current.length) await client.query("insert into chats(id,user_id,area,name) values($1,$2,'workspace',$3)",[conversationId,user.id,messages.at(-1).content.slice(0,80)]);
      await client.query("insert into messages(id,chat_id,user_id,sender,content) values($1,$2,$3,'user',$4)",[userMessageId,conversationId,user.id,messages.at(-1).content]);
      await client.query("insert into messages(id,chat_id,user_id,sender,content,created_at) values($1,$2,$3,'ai',$4,clock_timestamp())",[answerId,conversationId,user.id,answer]);
      await client.query('update chats set updated_at=now() where id=$1',[conversationId]);
      await client.query('select finish_credit_usage($1,$2,true)',[user.id,reservation]);
      const {rows:balance}=await client.query('select available_credits($1)::text as balance',[user.id]);
      return Number(balance[0]?.balance||0);
    });
    reservation = undefined;
    return reply({ answer, answerId, userMessageId, balance: nextBalance });
  } catch (error) {
    if (reservation) {
      try {
        await finishWorkspaceCredits(user.id, reservation, false);
      } catch (refundError) {
        console.error('Workspace credit refund requires reconciliation:', refundError);
      }
    }
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('Not enough Workspace credits') ? 402 : message.includes('Too many') ? 429 : 503;
    return reply({
      error: /Not enough Workspace credits|AI is not configured|AI service|Too many/.test(message)
        ? message
        : 'Unable to complete this Workspace task. Please try again later.',
    }, status);
  }
}
