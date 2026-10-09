import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';

test('complete Supabase schema preserves historical users and blocks cross-account message RPCs', async () => {
  const db = new PGlite();
  const historical = randomUUID();
  const newer = randomUUID();
  const chat = randomUUID();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
      create role anon; create role authenticated; create role service_role;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;
      insert into auth.users values('${historical}','{"full_name":"Historical account"}');`);
    for (const file of ['setup_db.sql','migrations/001_security.sql','migrations/002_billing_credits.sql']) await db.exec(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[newer,{ full_name:'New account' }]);
    const profiles = (await db.query('select id,full_name,selected_model from public.profiles order by full_name')).rows;
    assert.equal(profiles.length,2);
    assert.equal(profiles.find(profile => profile.id === historical).full_name,'Historical account');
    assert.equal(profiles.find(profile => profile.id === newer).selected_model,'claude-sonnet-4-6');
    await db.query('insert into public.chats(id,user_id) values($1,$2)',[chat,historical]);
    await db.exec(`set app.user_id='${newer}'`);
    await assert.rejects(db.query("select public.add_chat_message($1,$2,'user','forged')",[chat,newer]),/Not authorized/);
    await db.exec(`set app.user_id='${historical}'`);
    await db.query("select public.add_chat_message($1,$2,'user','owned message')",[chat,historical]);
    assert.equal((await db.query('select count(*)::int as count from public.messages')).rows[0].count,1);
  } finally { await db.close(); }
});
