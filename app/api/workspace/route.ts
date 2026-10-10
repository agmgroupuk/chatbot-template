import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/session';
import { throttle } from '@/lib/auth-service';
import { reserveWorkspaceCredits, finishWorkspaceCredits } from '@/lib/credits';
import { generateResponse } from '@/lib/ai';
import { query } from '@/lib/db';

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
    if (Number(request.headers.get('content-length') || 0) > 24000) return reply({ error: 'Message is too long.' }, 413);
    const body = await request.text();
    if (body.length > 24000) return reply({ error: 'Message is too long.' }, 413);
    let input: { messages?: unknown };
    try {
      input = JSON.parse(body) as { messages?: unknown };
    } catch {
      return reply({ error: 'Enter a valid message.' }, 400);
    }
    const messages = input.messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20 ||
        messages.some((value: { sender?: unknown; content?: unknown }) =>
          !value || !['user', 'ai'].includes(String(value.sender)) ||
          typeof value.content !== 'string' || value.content.length > 4000) ||
        messages.at(-1)?.sender !== 'user') {
      return reply({ error: 'Enter a valid message.' }, 400);
    }

    await throttle(`workspace:${user.id}`, 60);
    reservation = await reserveWorkspaceCredits(user.id);
    const answer = await generateResponse(messages as { id?: string; sender: 'user' | 'ai'; content: string }[]);
    await finishWorkspaceCredits(user.id, reservation, true);
    reservation = undefined;
    const [balance] = await query<{ balance: string }>('select available_credits($1)::text as balance', [user.id]);
    return reply({ answer, balance: Number(balance?.balance || 0) });
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
