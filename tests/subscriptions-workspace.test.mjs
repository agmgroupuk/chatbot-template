import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
function load(file,dependencies={},env={}){const exports={};const {outputText}=ts.transpileModule(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});runInNewContext(outputText,{exports,require:name=>name==='server-only'?{}:dependencies[name]||require(name),process:{env},Buffer,console,URL,Headers,Error});return exports;}
async function fixture(){const db=new PGlite();for(const file of readdirSync(new URL('../migrations/railway/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort())await db.exec(readFileSync(new URL(`../migrations/railway/${file}`,import.meta.url),'utf8'));const adapter={query:async(sql,args)=>(await db.query(sql,args)).rows,transaction:work=>db.transaction(tx=>work({query:(sql,args)=>tx.query(sql,args)}))};return {db,adapter};}
test('visitor limits are atomic, survive local identity clearing, refund once and reset by UTC day',async()=>{
 const {db,adapter}=await fixture();try{const usage=load('lib/visitor-usage.ts',{'./db':adapter});
 const results=await Promise.allSettled(Array.from({length:11},()=>usage.reserveVisitor(['network','browser','cookie'])));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,10);assert.equal(await usage.visitorRemaining(['network','new-browser','new-cookie']),0);
 await assert.rejects(usage.reserveVisitor(['network','new-browser','new-cookie']),/VISITOR_LIMIT/);
 assert.equal(await usage.visitorRemaining(['new-network','browser','fresh-cookie']),0);
 const id=results.find(result=>result.status==='fulfilled').value;await usage.finishVisitor(id,false);await usage.finishVisitor(id,false);assert.equal(await usage.visitorRemaining(['network']),1);
 const next=await usage.reserveVisitor(['network','browser','cookie']);await usage.finishVisitor(next,true);await usage.finishVisitor(next,false);assert.equal(await usage.visitorRemaining(['network']),0);
 await db.query("update visitor_usage set day=day-1");assert.equal(await usage.visitorRemaining(['network','browser']),10);
 }finally{await db.close();}
});
test('trusted network and keyed browser fingerprints persist without exposing raw identifiers',()=>{
 const identity=load('lib/abuse-identity.ts',{}, {NODE_ENV:'production',WORKSPACE_SIGNING_KEY:'fixture-key-that-is-at-least-32-characters'});
 const a=identity.visitorIdentities(new Headers({'x-real-ip':'203.0.113.4'}),'cookie-one','a'.repeat(64));
 const b=identity.visitorIdentities(new Headers({'x-real-ip':'203.0.113.4','x-forwarded-for':'1.2.3.4'}),'cookie-two','b'.repeat(64));
 assert.equal(a.filter(value=>b.includes(value)).length,1);assert.ok(a.every(value=>/^[a-f0-9]{64}$/.test(value)));
 assert.throws(()=>identity.visitorIdentities(new Headers({'x-forwarded-for':'1.2.3.4'}),'cookie','a'.repeat(64)),/network/);
 const v6a=identity.visitorIdentities(new Headers({'x-real-ip':'2001:db8:abcd:1234::1'}),'one','a'.repeat(64));
 const v6b=identity.visitorIdentities(new Headers({'x-real-ip':'2001:db8:abcd:1234::ff'}),'two','b'.repeat(64));assert.equal(v6a.filter(value=>v6b.includes(value)).length,1);
});
test('account sessions require a fresh login after an absolute 30-day expiry',async()=>{
 const {db,adapter}=await fixture();try{const user=randomUUID();await db.query("insert into app_users(id,email,password_hash,email_verified_at) values($1,'session@example.test','fixture',now())",[user]);const password=load('lib/password.ts');let savedCookie;
 const session=load('lib/session.ts',{'./db':adapter,'./password':password,'react':{cache:fn=>fn},'next/headers':{cookies:async()=>({set:(name,value,options)=>{savedCookie={name,value,options};}})}},{NODE_ENV:'production'});
 await session.createSession(user);assert.equal(savedCookie.options.maxAge,30*86400);assert.equal(savedCookie.options.secure,true);assert.equal((await session.userFromToken(savedCookie.value)).id,user);
 const [row]=await adapter.query('select extract(epoch from expires_at-created_at)::int as seconds from app_sessions');assert.equal(row.seconds,30*86400);
 await db.query("update app_sessions set expires_at=now()-interval '1 second'");assert.equal(await session.userFromToken(savedCookie.value),null);
 }finally{await db.close();}
});
test('card-first trials, retry recovery, cross-account card claims, paid access and scheduled changes',async()=>{
 const {db,adapter}=await fixture();try{
 const first=randomUUID(),second=randomUUID();let current=first;
 for(const [id,email]of[[first,'one@example.test'],[second,'two@example.test']]){await db.query("insert into app_users(id,email,password_hash,email_verified_at) values($1,$2,'fixture',now())",[id,email]);await db.query('insert into profiles(id) values($1)',[id]);await db.query('insert into billing_customers(user_id,customer_id) values($1,$2)',[id,`cus_${id}`]);}
 const plans=load('lib/plans.ts'),catalog=load('lib/subscription-catalog.ts',{'./plans':plans});
 const prices=plans.plans.map(plan=>({id:`price_${plan.key}`,lookup_key:plans.lookupKey(plan.key),active:true,livemode:false,currency:'usd',unit_amount:plan.amount,recurring:{interval:plan.interval,interval_count:1},metadata:{app:'chatbot-template'}}));
 const setups=new Map(),subs=new Map(),notices=[];let creates=0,throwAfterCreate=false,capturedSchedule;
 const stripe={prices:{list:async({lookup_keys})=>({data:prices.filter(price=>lookup_keys.includes(price.lookup_key))}),retrieve:async id=>prices.find(price=>price.id===id)},setupIntents:{create:async params=>{const id=`seti_${randomUUID()}`;const setup={...params,id,status:'requires_payment_method',livemode:false,client_secret:'fixture-secret'};setups.set(id,setup);return setup;},retrieve:async id=>setups.get(id)},paymentMethods:{retrieve:async id=>({id,type:'card',customer:`cus_${current}`,card:{fingerprint:'same-card'}})},subscriptions:{list:async({customer})=>({data:[...subs.values()].filter(sub=>sub.customer===customer),has_more:false}),retrieve:async id=>subs.get(id),create:async params=>{creates++;const now=Math.floor(Date.now()/1000),id=`sub_${creates}`;const sub={...params,id,livemode:false,status:params.trial_end?'trialing':'incomplete',trial_end:params.trial_end||null,cancel_at_period_end:false,items:{data:[{price:prices.find(price=>price.id===params.items[0].price),quantity:1,current_period_start:now,current_period_end:params.trial_end||now+2592000}]},latest_invoice:null};subs.set(id,sub);if(throwAfterCreate){throwAfterCreate=false;throw new Error('simulated lost response');}return sub;}},invoices:{retrieve:async()=>invoice,listLineItems:async function*(){yield line;}},subscriptionSchedules:{create:async()=>({id:'sched_1',current_phase:null}),update:async(id,value)=>{capturedSchedule=value;},retrieve:async()=>({id:'sched_1',metadata:{app:'chatbot-template'}}),release:async()=>{}}};
 const fulfillment=load('lib/stripe-fulfillment.ts',{'./db':adapter,'./credit-config':{creditPlans:()=>({})},'./subscription-catalog':catalog,'./billing-notices':{queueBillingNotice:async(...args)=>notices.push(args)},'./plans':plans});
 const enroll=load('lib/subscription-enrollment.ts',{'./db':adapter,'./stripe':{verifiedStripe:async()=>stripe},'./stripe-billing':{currentCustomer:async()=>`cus_${current}`},'./subscription-catalog':catalog,'./plans':plans,'./abuse-identity':{privateHash:value=>value},'./stripe-fulfillment':fulfillment});
 const setup=await enroll.prepareEnrollment(first,'monthly','trial');await assert.rejects(enroll.completeEnrollment(first,setup.setupId,true),/verification/);assert.equal(creates,0);
 setups.get(setup.setupId).status='succeeded';setups.get(setup.setupId).payment_method='pm_card';
 await assert.rejects(enroll.completeEnrollment(first,setup.setupId,false),/terms/);
 throwAfterCreate=true;await assert.rejects(enroll.completeEnrollment(first,setup.setupId,true),/lost response/);
 assert.equal((await adapter.query('select * from billing_trial_claims')).length,1);
 const result=await enroll.completeEnrollment(first,setup.setupId,true);assert.equal(result.status,'trialing');assert.equal(creates,1);
 await enroll.completeEnrollment(first,setup.setupId,true);assert.equal(creates,1);
 const [access]=await adapter.query('select * from membership_access where user_id=$1',[first]);assert.ok(access.expires_at>new Date());assert.equal(notices[0][0],'trial:sub_1');
 current=second;const other=await enroll.prepareEnrollment(second,'daily','trial');setups.get(other.setupId).status='succeeded';setups.get(other.setupId).payment_method='pm_other';await assert.rejects(enroll.completeEnrollment(second,other.setupId,true),/already been used/);assert.equal(creates,1);
 current=first;
 const billing=load('lib/stripe-billing.ts',{'./db':adapter,'./stripe':{verifiedStripe:async()=>stripe},'./session':{currentUser:async()=>({id:first,email:'one@example.test'})},'./subscription-catalog':catalog,'./plans':plans,'./stripe-fulfillment':fulfillment,'./credit-config':{},'./site-url':{}});
 await billing.schedulePlanChange('weekly');assert.equal(capturedSchedule.proration_behavior,'none');assert.equal(capturedSchedule.phases[0].trial_end,subs.get('sub_1').trial_end);assert.equal(capturedSchedule.phases[1].duration.interval,'week');assert.equal(capturedSchedule.phases[1].trial_end,undefined);
 const credits=load('lib/credits.ts',{'./db':adapter,'./credit-config':{signupCredits:()=>0,chatCreditCost:()=>1}});const use=await credits.reserveChatCredits(first);await credits.finishChatCredits(first,use,true);assert.equal((await adapter.query('select * from credit_allocations')).length,0);
 let invoice={id:'in_paid',parent:{subscription_details:{subscription:'sub_1',metadata:{app:'chatbot-template'}}},customer:`cus_${first}`,livemode:false,status:'paid',currency:'usd',amount_paid:0,amount_remaining:0};
 let line={id:'line',quantity:1,amount:3000,pricing:{price_details:{price:'price_monthly'}},period:{end:Math.floor(Date.now()/1000)+2592000}};
 const event={type:'invoice.paid',livemode:false,data:{object:{id:'in_paid'}}};await fulfillment.fulfillStripeEvent(stripe,event);assert.equal((await adapter.query('select expires_at from membership_access'))[0].expires_at.getTime(),access.expires_at.getTime());
 subs.get('sub_1').status='active';invoice.amount_paid=3000;await fulfillment.fulfillStripeEvent(stripe,event);await fulfillment.fulfillStripeEvent(stripe,event);const expires=(await adapter.query('select expires_at from membership_access'))[0].expires_at;assert.equal(expires.getTime(),line.period.end*1000);
 line.period.end-=86400;await fulfillment.fulfillStripeEvent(stripe,event);assert.equal((await adapter.query('select expires_at from membership_access'))[0].expires_at.getTime(),expires.getTime());
 await db.query("update membership_access set expires_at=now()-interval '1 second'");await assert.rejects(credits.reserveChatCredits(first),/Not enough credits/);
 }finally{await db.close();}
});
