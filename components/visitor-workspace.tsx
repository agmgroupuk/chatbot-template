'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
async function browserIdentity() {
  const details=[navigator.userAgent,navigator.language,navigator.hardwareConcurrency,screen.width,screen.height,screen.colorDepth,Intl.DateTimeFormat().resolvedOptions().timeZone].join('|');
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(details)))).map(value=>value.toString(16).padStart(2,'0')).join('');
}
export function VisitorWorkspace() {
  const [fingerprint,setFingerprint]=useState(''),[remaining,setRemaining]=useState<number|null>(10),[messages,setMessages]=useState<{sender:'user'|'ai';content:string}[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[signedIn,setSignedIn]=useState(false);
  useEffect(()=>{let active=true;browserIdentity().then(async id=>{if(!active)return;setFingerprint(id);const response=await fetch(`/api/workspace?fingerprint=${id}`,{cache:'no-store'});const data=await response.json();if(active){if(!response.ok)setError(data.error);else{setRemaining(data.remaining);setSignedIn(data.signedIn);}}}).catch(()=>{if(active)setError('Unable to initialize the workspace. Please try again.');});return()=>{active=false;};},[]);
  async function send(event:React.FormEvent) {
    event.preventDefault();if(busy||!input.trim()||remaining===0)return;
    const next=[...messages,{sender:'user' as const,content:input.trim()}].slice(-19);
    const requestMessages=next.map(message=>({...message,content:message.content.slice(0,4000)}));
    while(requestMessages.length>1&&requestMessages.reduce((total,message)=>total+message.content.length,0)>16000)requestMessages.shift();
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fingerprint,messages:requestMessages})});
      const data=await response.json();
      if(data.limited)setRemaining(0);
      if(!response.ok)throw new Error(data.error);
      setMessages([...next,{sender:'ai',content:data.answer}]);setInput('');setRemaining(data.remaining);
    }catch(error){setError(error instanceof Error?error.message:'Please try again.');}finally{setBusy(false);}
  }
  return <><div className="setting-row"><span className="badge">{signedIn?'Your account allowance':`${remaining??10} of 10 visitor responses left today`}</span><Link className="button secondary small" href="/pricing">Explore plans & subscribe</Link></div><section className="panel stack" aria-label="Workspace conversation"><div role="log" aria-live="polite" className="stack">{messages.length?messages.map((message,index)=><div className="notice" key={index}><strong>{message.sender==='user'?'You':'One Fin'}</strong><p className="whitespace-pre-wrap break-words">{message.content}</p></div>):<div className="empty-state"><h2>What would you like to work on?</h2><p>Ask a question or bring an idea. You can start here immediately.</p></div>}</div>{error&&<p className="notice error" role="alert">{error}</p>}{remaining===0?<div className="notice" role="status"><h2>Your visitor allowance is used up.</h2><p>Continue with a card-backed free trial, sign in to use your account allowance, or subscribe. Visitor access resets at midnight UTC.</p><div className="button-row"><Link className="button" href="/pricing">Start a free trial</Link><Link className="button secondary" href="/sign-in?next=/workspace">Sign in</Link><Link className="text-link" href="/subscribe?plan=monthly&mode=paid">Subscribe now</Link></div></div>:<form onSubmit={send} className="stack"><label className="field">Your message<textarea aria-label="Workspace message" required maxLength={4000} rows={4} value={input} onChange={event=>setInput(event.target.value)} disabled={busy} /></label><button className="button" disabled={busy||!fingerprint||!input.trim()}>{busy?'Thinking...':'Send message'}</button></form>}</section><p className="small-copy">Visitor limits reset daily at midnight UTC. We use a secure cookie, hashed browser characteristics, and a hashed network identifier to limit misuse. Clearing browser data does not reset server records; shared networks can share a limit. <Link className="text-link" href="/privacy">Privacy details</Link>. This conversation stays in this page and is cleared when you leave. Account sessions require a fresh sign-in every 30 days.</p></>;
}
