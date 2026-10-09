import { readFileSync } from 'node:fs';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const token = process.env.SUPABASE_ACCESS_TOKEN;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!token || !url) throw new Error('SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL are required.');
const match = new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
if (!match) throw new Error('Expected the intended hosted Supabase project URL.');
const project = match[1];
async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method:'POST',headers:{ Authorization:`Bearer ${token}`,'Content-Type':'application/json' },body:JSON.stringify({query:sql}),
  });
  if (!response.ok) throw new Error(`Supabase migration request failed (${response.status}); credentials and SQL response suppressed.`);
  return response.json();
}
const inventory = await query("select to_regclass('auth.users') as auth_users,to_regclass('public.profiles') as profiles");
if (!inventory[0]?.auth_users) throw new Error('Supabase auth schema is missing; refusing to target an unrelated database.');
const files = [...(!inventory[0].profiles ? ['setup_db.sql'] : []),'migrations/001_security.sql','migrations/002_billing_credits.sql'];
if (!process.argv.includes('--apply')) {
  console.log(`Dry run: Supabase ${project}; migrations to verify/apply: ${files.join(', ')}`);
  process.exit(0);
}
await query('create table if not exists public.app_schema_migrations(name text primary key, applied_at timestamptz not null default now()); alter table public.app_schema_migrations enable row level security; revoke all on public.app_schema_migrations from anon,authenticated;');
for (const file of files) {
  const applied = await query(`select name from public.app_schema_migrations where name='${file}'`);
  if (applied.length) { console.log(`Already applied ${file}`); continue; }
  const source = readFileSync(new URL(`../${file}`,import.meta.url),'utf8').replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'');
  await query(`begin;\n${source}\ninsert into public.app_schema_migrations(name) values('${file}');\ncommit;`);
  console.log(`Applied ${file}`);
}
