import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
test('native Railway schema isolates profiles, contexts and chat messages with RLS',async()=>{
 const db=new PGlite(); const owner=randomUUID(),other=randomUUID(),chat=randomUUID();
 try {
  for(const name of ['001_schema.sql','002_credits.sql']) await db.exec(readFileSync(new URL(`../migrations/railway/${name}`,import.meta.url),'utf8'));
  await db.query("insert into app_users(id,email,password_hash) values($1,'one@example.test','fixture'),($2,'two@example.test','fixture')",[owner,other]);
  await db.query('insert into profiles(id) values($1),($2)',[owner,other]);
  await db.query('insert into chats(id,user_id) values($1,$2)',[chat,owner]);
  await db.exec(`set role app_user; set app.user_id='${other}';`);
  assert.equal((await db.query('select * from profiles')).rows.length,1);
  assert.equal((await db.query('select * from chats')).rows.length,0);
  await assert.rejects(db.query("insert into messages(chat_id,user_id,sender,content) values($1,$2,'user','forged')",[chat,other]),/row-level security/);
  await assert.rejects(db.query('select * from app_users'),/permission denied/);
  await db.exec(`reset role; set app.user_id='${owner}'; set role app_user;`);
  await db.query("insert into messages(chat_id,user_id,sender,content) values($1,$2,'user','owned')",[chat,owner]);
  assert.equal((await db.query('select * from messages')).rows.length,1);
 } finally {await db.close();}
});


test('stripe webhook event ledger migration is backward-compatible and unique on event_id', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      readFileSync(new URL('../migrations/railway/013_stripe_webhook_events.sql', import.meta.url), 'utf8'),
    );
    await db.query(
      `insert into stripe_webhook_events (event_id, event_type, livemode, status)
       values ('evt_1', 'invoice.paid', false, 'processing')`,
    );
    await assert.rejects(
      db.query(
        `insert into stripe_webhook_events (event_id, event_type, livemode, status)
         values ('evt_1', 'invoice.paid', false, 'processing')`,
      ),
      /duplicate key|unique/i,
    );
    await assert.rejects(
      db.query(
        `insert into stripe_webhook_events (event_id, event_type, livemode, status)
         values ('evt_2', 'invoice.paid', false, 'done')`,
      ),
      /check/i,
    );
    await assert.rejects(
      db.query(
        `insert into stripe_webhook_events (event_id, event_type, livemode, status, processed_at)
         values ('evt_3', 'invoice.paid', false, 'processed', null)`,
      ),
      /check/i,
    );
    await db.query(
      `insert into stripe_webhook_events (event_id, event_type, livemode, status, processed_at)
       values ('evt_4', 'invoice.paid', false, 'processed', now())`,
    );
    assert.equal((await db.query('select * from stripe_webhook_events')).rows.length, 2);
  } finally {
    await db.close();
  }
});
