import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { currentUser } from '@/lib/session';
import { privateHash,visitorIdentities } from '@/lib/abuse-identity';
import { reserveVisitor,finishVisitor,visitorRemaining } from '@/lib/visitor-usage';
import { reserveChatCredits,finishChatCredits } from '@/lib/credits';
import { generateResponse } from '@/lib/ai';
import { throttle } from '@/lib/auth-service';
export const runtime='nodejs';
function visitor(request:NextRequest,fingerprint:string) {
  const raw=request.cookies.get('onefin-visitor')?.value||'';
  const [id,signature]=raw.split('.');
  const valid=/^[a-f0-9-]{36}$/.test(id||'')&&signature===privateHash(`visitor:${id}`);
  const token=valid?id:randomUUID();
  return {identities:visitorIdentities(request.headers,token,fingerprint),cookie:`${token}.${privateHash(`visitor:${token}`)}`};
}
function reply(body:unknown,status=200,cookie?:string) {
  const response=NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  if(cookie) response.cookies.set('onefin-visitor',cookie,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:32*86400});
  return response;
}
export async function GET(request:NextRequest) {
  try {
    const user=await currentUser();
    if(user) return reply({signedIn:true,remaining:null});
    const identity=visitor(request,request.nextUrl.searchParams.get('fingerprint')||'');
    return reply({signedIn:false,remaining:await visitorRemaining(identity.identities)},200,identity.cookie);
  } catch { return reply({error:'Visitor access is unavailable. Please try again later or sign in.'},503); }
}
export async function POST(request:NextRequest) {
  // Same-origin POSTs only. The host comes from the request URL, not a body field.
  if(request.headers.get('origin')!==request.nextUrl.origin && request.headers.get('origin')!==process.env.NEXT_PUBLIC_SITE_URL) return reply({error:'Invalid request origin.'},403);
  let reservation:string|undefined,userId:string|undefined,cookie:string|undefined,identities:string[]=[];
  try {
    if(Number(request.headers.get('content-length')||0)>24000) return reply({error:'Message is too long.'},413);
    const body=await request.text();if(body.length>24000) return reply({error:'Message is too long.'},413);
    const input=JSON.parse(body);
    if(!Array.isArray(input.messages)||input.messages.length<1||input.messages.length>20||input.messages.some((value:{sender:string;content:string})=>!['user','ai'].includes(value?.sender)||typeof value.content!=='string'||value.content.length>4000)||input.messages.at(-1)?.sender!=='user') return reply({error:'Enter a valid message.'},400);
    const user=await currentUser();userId=user?.id;
    if(user) {
      await throttle(`workspace:${user.id}`,60);
      reservation=await reserveChatCredits(user.id);
    } else {
      const identity=visitor(request,input.fingerprint||'');cookie=identity.cookie;identities=identity.identities;
      await throttle(`visitor:${identities[0]}`,30);
      reservation=await reserveVisitor(identities);
    }
    const answer=await generateResponse(input.messages);
    if(userId) await finishChatCredits(userId,reservation,true);else await finishVisitor(reservation,true);
    reservation=undefined;
    return reply({answer,remaining:userId?null:await visitorRemaining(identities)},200,cookie);
  } catch(error) {
    if(reservation) {if(userId)await finishChatCredits(userId,reservation,false);else await finishVisitor(reservation,false);}
    const message=error instanceof Error?error.message:'';
    if(message==='VISITOR_LIMIT') return reply({error:'You have used your 10 visitor responses for today. Start a free trial, sign in, or subscribe to continue.',limited:true,remaining:0},429,cookie);
    return reply({error:/Not enough credits|AI is not configured|AI service|Too many/.test(message)?message:'Unable to complete this response. Please try again later.'},503,cookie);
  }
}
