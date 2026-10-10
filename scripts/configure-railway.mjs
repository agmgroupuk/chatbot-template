import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());

const project = '3c67a3e5-8d96-462c-8ed1-9c2c64a4949f';
const service = '4c84fc8a-e259-4a50-9de3-6be2e88a8911';
const executable = process.platform === 'win32' ? join(process.env.APPDATA, 'npm/node_modules/@railway/cli/bin/railway.exe') : 'railway';
const generated = new URL('../.env.stripe-generated', import.meta.url);
if (!process.env.STRIPE_WEBHOOK_SECRET && existsSync(generated)) {
  process.env.STRIPE_WEBHOOK_SECRET = readFileSync(generated,'utf8').split('\n').find(line => line.startsWith('STRIPE_WEBHOOK_SECRET='))?.slice('STRIPE_WEBHOOK_SECRET='.length).trim();
}
const artifact = new URL('../billing/stripe-test-ids.json', import.meta.url);
if ((!process.env.STRIPE_CREDIT_PLANS || process.env.STRIPE_CREDIT_PLANS === '{}') && existsSync(artifact)) {
  const catalog = JSON.parse(readFileSync(artifact,'utf8'));
  if (catalog.mode !== 'test' || catalog.accountId !== process.env.STRIPE_EXPECTED_ACCOUNT_ID) throw new Error('Catalog account mismatch.');
  process.env.STRIPE_CREDIT_PLANS = JSON.stringify(Object.fromEntries(Object.values(catalog.prices).map(price => [price.priceId,{ credits: price.credits, kind: price.interval ? 'subscription' : 'pack' }])));
}
const required = ['STRIPE_SECRET_KEY','STRIPE_EXPECTED_ACCOUNT_ID','STRIPE_WEBHOOK_SECRET','STRIPE_CREDIT_PLANS'];
const missing = required.filter(name => !process.env[name] || process.env[name] === '{}');
if (missing.length) throw new Error(`Missing required credentials/configuration: ${missing.join(', ')}. No variables were changed.`);
if (!/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY)) throw new Error('Live Stripe keys are prohibited.');
const check = spawnSync(executable,['status','--json'],{ encoding:'utf8' });
if (check.status !== 0 || JSON.parse(check.stdout).id !== project) throw new Error('Railway project verification failed.');
const optional=['OPENAI_API_KEY','XAI_API_KEY','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','EMAIL_FROM','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'];
const values = { ...Object.fromEntries([...required,...optional].filter(name=>process.env[name]).map(name => [name,process.env[name]])),
  AI_PROVIDER:process.env.AI_PROVIDER||'openai',OPENAI_MODEL:process.env.OPENAI_MODEL||'gpt-4.1-mini',XAI_MODEL:process.env.XAI_MODEL||'grok-4.3',
  NEXT_PUBLIC_SITE_URL:'https://onefinsolution.online', STRIPE_MODE:'test', BILLING_PROVIDER:'stripe', PORT:'8080',
  SIGNUP_CREDITS: process.env.SIGNUP_CREDITS || '10',
  WORKSPACE_CREDIT_COST: process.env.WORKSPACE_CREDIT_COST || process.env.CHAT_CREDIT_COST || '1',
};
if (!process.argv.includes('--apply')) {
  console.log(`Dry run: verified project. Would configure these names only: ${Object.keys(values).join(', ')}`);
  process.exit(0);
}
for (const [name,value] of Object.entries(values)) {
  const result = spawnSync(executable,['variable','set',name,'--stdin','--skip-deploys','--project',project,'--service',service,'--environment','production'],{ input:value,encoding:'utf8' });
  if (result.status !== 0) throw new Error(`Unable to configure ${name}. Secret values have been suppressed.`);
  console.log(`Configured ${name}`);
}
console.log('Variables configured. Rebuild/redeploy the committed source, then run end-to-end tests.');
