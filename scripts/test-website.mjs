// Isolated end-to-end verification. Never connects to Railway or real providers.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {randomUUID,createHash,scryptSync} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import {chromium} from '@playwright/test';

const port=Number(process.env.WEBSITE_TEST_PORT||3015),dbPort=Number(process.env.WEBSITE_TEST_DB_PORT||55435);
const origin=`http://localhost:${port}`;
const artifacts=new URL('../.test-artifacts/website/',import.meta.url);
mkdirSync(artifacts,{recursive:true});
// Use a real local PostgreSQL process: the PGlite wire adapter cannot reliably
// multiplex the application's concurrent transactions and extended queries.
const cluster=new EmbeddedPostgres({databaseDir:fileURLToPath(new URL(`postgres-${randomUUID()}/`,artifacts)),user:'postgres',password:'postgres',port:dbPort,persistent:true,initdbFlags:['--no-locale','--encoding=UTF8','--locale-provider=libc'],postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
await cluster.initialise();
await cluster.start();
const connection=cluster.getPgClient();
await connection.connect();
const db={query:(sql,args)=>connection.query(sql,args),exec:sql=>connection.query(sql),close:()=>connection.end()};
for(const migration of readdirSync(new URL('../migrations/railway/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(`../migrations/railway/${migration}`,import.meta.url),'utf8'));
await db.exec("create table app_migrations(name text primary key,checksum text not null,applied_at timestamptz not null default now()); insert into app_migrations(name,checksum) values ('001_schema.sql','fixture'),('002_credits.sql','fixture'),('003_website_foundation.sql','fixture'),('004_trials_workspace.sql','fixture');");
const user=randomUUID(),other=randomUUID(),chat=randomUUID();
const password='browser-fixture-password';
const hash=`scrypt-v1:fixture-salt:${scryptSync(password,'fixture-salt',64,{N:32768,r:8,p:3,maxmem:64*1024*1024}).toString('hex')}`;
await db.query('insert into app_users(id,email,password_hash,email_verified_at) values($1,$2,$3,now()),($4,$5,$3,now())',[user,'browser@example.test',hash,other,'other@example.test']);
await db.query('insert into profiles(id,full_name) values($1,$2),($3,$4)',[user,'Browser Fixture',other,'Other Private User']);
await db.query('insert into chats(id,user_id,name) values($1,$2,$3)',[chat,user,'My saved conversation']);
await db.query("insert into chats(user_id,name) values($1,'Other user private conversation')",[other]);
await db.query("insert into messages(chat_id,user_id,sender,content) values($1,$2,'user','My fixture message')",[chat,user]);
const resetToken='r'.repeat(43);
await db.query("insert into auth_tokens(token_hash,user_id,purpose,expires_at) values($1,$2,'reset',now()+interval '30 minutes')",[createHash('sha256').update(resetToken).digest('hex'),user]);
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:new URL('../',import.meta.url),windowsHide:true,env:{...process.env,NODE_ENV:'production',DATABASE_POOL_MAX:'10',DATABASE_URL:`postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres`,NEXT_PUBLIC_SITE_URL:'https://onefinsolution.online',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',SMTP_HOST:'',OPENAI_API_KEY:'',XAI_API_KEY:'',SIGNUP_CREDITS:'10',WORKSPACE_SIGNING_KEY:'website-fixture-security-key-over-32-chars'},stdio:['ignore','pipe','pipe']});
let logs='';app.stdout.on('data',chunk=>{logs+=chunk;});app.stderr.on('data',chunk=>{logs+=chunk;});
let browser, page;const failures=[];let checks=0;const pending=new Set();const actionLog=[];
try {
  let ready=false;
  for(let attempt=0;attempt<90;attempt++){try {const response=await fetch(`${origin}/api/health`);if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
  assert.ok(ready,'Local application must start');
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-real-ip':'203.0.113.20'}});
  page=await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror',error=>failures.push(error.message));
  page.on('request',request=>{pending.add(request);if(request.method()==='POST')actionLog.push(['start',new URL(request.url()).pathname,request.headers()['next-action']]);});
  page.on('requestfinished',request=>{pending.delete(request);if(request.method()==='POST')actionLog.push(['done',new URL(request.url()).pathname]);});
  page.on('requestfailed',request=>{pending.delete(request);actionLog.push(['failed',new URL(request.url()).pathname,request.failure()?.errorText]);});
  async function check(path,title){console.log(`Checking ${path}`);const response=await page.goto(`${origin}${path}`);assert.equal(response.status(),200,path);await page.getByRole('heading',{level:1,name:title}).waitFor();assert.equal(await page.locator('h1').count(),1,`${path}: one page heading`);assert.ok(await page.locator('footer').isVisible());checks++;}
  await check('/',/Make room for/);
  await page.screenshot({path:new URL('home-desktop.png',artifacts).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  for(const [path,title] of [['/about','Software with a practical purpose.'],['/privacy','Privacy Policy'],['/terms','Terms & Conditions'],['/payment-policy','Payment, Cancellation & Refund Policy'],['/support','A little help goes a long way.'],['/contact','Let’s get you to the right place.'],['/pricing','Choose the time that fits your work.'],['/forgot-password','Forgot your password?'],['/reset-password','Request a fresh reset link.'],['/sign-in','Your workspace is waiting.'],['/sign-up','A place for your next idea.']]) await check(path,title);
  for(const path of ['/dashboard','/dashboard/activity','/dashboard/billing','/account/security','/chat']){await page.goto(`${origin}${path}`);assert.equal(new URL(page.url()).pathname,'/sign-in');checks++;}
  await page.goto(`${origin}/pricing`);
  for(const interval of ['Daily','Weekly','Monthly','Yearly']) assert.ok(await page.getByRole('heading',{name:interval,exact:true}).isVisible());
  await page.getByRole('link',{name:'Start daily trial',exact:true}).click();await page.getByRole('heading',{level:1,name:'Daily: $5 USD / day'}).waitFor();assert.ok(await page.getByRole('link',{name:'Sign in to continue'}).isVisible());checks++;
  await page.goto(`${origin}/support`);await page.getByLabel('Search the help center').fill('forgot');assert.equal(await page.locator('details').count(),1);await page.locator('summary').click();assert.ok(await page.getByText('The link lasts 30 minutes',{exact:false}).isVisible());checks++;
  await page.goto(`${origin}/contact`);await page.getByLabel('Your name').fill('Guest Fixture');await page.getByLabel('Email address').fill('guest@example.test');await page.getByLabel('Subject',{exact:true}).fill('Guest support question');await page.getByLabel(/^Message/).fill('Please help me understand which plan interval fits my needs.');await page.getByRole('button',{name:'Submit request',exact:true}).click();await page.getByRole('heading',{name:'Thank you for reaching out.'}).waitFor();checks++;
  await page.goto(`${origin}/sign-in`);await page.getByLabel('Email address').fill('browser@example.test');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');await page.getByRole('heading',{name:'Welcome back, Browser.'}).waitFor();assert.ok(await page.getByRole('link',{name:'My saved conversation',exact:true}).isVisible());assert.equal(await page.getByText('Other user private conversation',{exact:true}).count(),0);checks++;
  await page.screenshot({path:new URL('dashboard-desktop.png',artifacts).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  await page.goto(`${origin}/account`);await page.getByLabel('Full name',{exact:true}).fill('Updated Browser');await page.getByLabel(/^Username/).fill('browser_fixture');await page.getByLabel('Website',{exact:true}).fill('https://example.test');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('status').filter({hasText:'Profile saved.'}).waitFor();await page.reload();assert.equal(await page.getByLabel('Full name',{exact:true}).inputValue(),'Updated Browser');checks++;
  await page.goto(`${origin}/account/preferences`);await page.getByLabel('Appearance',{exact:true}).selectOption('dark');await page.getByLabel('Time zone',{exact:false}).selectOption('UTC');await page.getByLabel('Enter to send',{exact:false}).uncheck();await page.getByLabel('Browser spellcheck',{exact:false}).uncheck();await page.getByRole('button',{name:'Save preferences',exact:true}).click();await page.getByRole('status').filter({hasText:'Preferences saved.'}).waitFor();await page.reload();assert.equal(await page.getByLabel('Appearance',{exact:true}).inputValue(),'dark');assert.equal(await page.getByLabel('Enter to send',{exact:false}).isChecked(),false);checks++;
  await page.goto(`${origin}/chat`);await page.getByRole('textbox',{name:'Message',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('textarea')?.spellcheck===false);await page.getByRole('textbox',{name:'Message',exact:true}).fill('Do not send this');await page.getByRole('textbox',{name:'Message',exact:true}).press('Enter');assert.equal(new URL(page.url()).pathname,'/chat');assert.ok((await page.getByRole('textbox',{name:'Message',exact:true}).inputValue()).includes('\n'));checks++;
  await page.goto(`${origin}/contact?category=technical`);await page.getByLabel('Your name').fill('Browser Fixture');await page.getByLabel('Subject',{exact:true}).fill('Signed in request');await page.getByLabel(/^Message/).fill('Please help with a question about my saved workspace settings.');await page.getByRole('button',{name:'Submit request',exact:true}).click();await page.getByRole('heading',{name:'Thank you for reaching out.'}).waitFor();await page.goto(`${origin}/dashboard/support`);await page.getByRole('heading',{name:'Signed in request',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Guest support question',exact:true}).count(),0);checks++;
  const exported=await context.request.get(`${origin}/api/account/export`);assert.equal(exported.status(),200);const data=await exported.json();assert.equal(data.account.email,'browser@example.test');assert.equal(data.profile.full_name,'Updated Browser');assert.equal(data.chats.length,1);assert.equal(JSON.stringify(data).includes('password_hash'),false);assert.equal(JSON.stringify(data).includes('Other user private'),false);checks++;
  for(const path of ['/account/security','/account/plugins','/account/privacy','/dashboard/activity','/dashboard/billing']){const response=await page.goto(`${origin}${path}`);assert.equal(response.status(),200);await page.locator('h1').waitFor();assert.equal(await page.getByRole('heading',{name:/Something went wrong/}).count(),0);checks++;}
  await page.goto(`${origin}/dashboard/activity`);await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'Keep it',exact:true}).click();assert.ok(await page.getByRole('link',{name:'My saved conversation',exact:true}).isVisible());await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'Delete permanently',exact:true}).click();await page.getByText('No conversations yet.',{exact:false}).waitFor();checks++;
  await context.clearCookies();await context.addCookies([{name:'onefin-reset',value:resetToken,url:origin,httpOnly:true,sameSite:'Lax'}]);await page.goto(`${origin}/reset-password`);await page.getByLabel('New password',{exact:true}).fill('browser-replacement-password');await page.getByLabel('Confirm new password',{exact:true}).fill('browser-replacement-password');await page.getByRole('button',{name:'Update password',exact:true}).click();await page.waitForURL('**/sign-in?success=*');checks++;
  await page.goto(`${origin}/forgot-password`);await page.getByLabel('Email address').fill('browser@example.test');await page.getByRole('button',{name:'Send reset link',exact:true}).click();await page.getByRole('alert').filter({hasText:'Email delivery is not configured'}).waitFor();checks++;
  await page.goto(`${origin}/workspace`);await page.getByRole('heading',{level:1,name:'Start with an idea.'}).waitFor();await page.getByRole('textbox',{name:'Workspace message'}).fill('Hello fixture');await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByRole('alert').filter({hasText:'AI is not configured'}).waitFor();assert.equal((await db.query('select max(used) as used from visitor_usage')).rows[0].used,0);checks++;
  await db.query('update visitor_usage set used=10');await page.reload();await page.getByRole('heading',{name:'Your visitor allowance is used up.'}).waitFor();assert.ok(await page.getByRole('link',{name:'Start a free trial',exact:true}).isVisible());await context.clearCookies();await page.reload();await page.getByRole('heading',{name:'Your visitor allowance is used up.'}).waitFor();checks++;
  await page.setViewportSize({width:390,height:844});
  for(const path of ['/','/pricing','/support','/contact','/privacy','/forgot-password']){await page.goto(`${origin}${path}`);await page.locator('h1').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${path} mobile overflow`);checks++;}
  await page.goto(`${origin}/`);await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('navigation',{name:'Mobile navigation',exact:true}).getByRole('link',{name:'Contact',exact:true}).click();await page.waitForURL('**/contact');await page.getByRole('heading',{level:1}).waitFor();checks++;
  await page.goto(`${origin}/pricing`);await page.getByRole('heading',{name:'Daily',exact:true}).waitFor();await page.screenshot({path:new URL('pricing-mobile.png',artifacts).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  assert.deepEqual(failures,[],'No browser JavaScript errors');
  console.log(`Passed ${checks} website checks against an isolated local database.`);
} catch(error) {
  console.error('Recent action log',actionLog.slice(-30));console.error('Pending requests',[...pending].slice(-20).map(request=>[request.method(),request.url()]));
  console.error('Database activity', (await db.query("select state,wait_event_type,wait_event,left(query,180) as query from pg_stat_activity where datname=current_database()" )).rows);
  console.error('Fixture profile', (await db.query('select full_name from profiles where id=$1',[user])).rows);
  if(page) { console.error("Failed at",page.url()); console.error((await page.locator("body").innerText().catch(()=>"No page text")).slice(0,2200)); await page.screenshot({path:new URL("failure.png",artifacts).pathname.replace(/^\/([A-Z]:)/,"$1"),fullPage:true}).catch(()=>{}); }
  throw error;
} finally {
  writeFileSync(new URL('server.log',artifacts),logs);
  await browser?.close();app.kill();if(app.exitCode===null)await new Promise(resolve=>app.once('exit',resolve));await db.close();await cluster.stop();
}
