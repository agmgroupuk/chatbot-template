import 'server-only';
import { randomUUID } from 'node:crypto';
import { query, transaction } from './db';
export const visitorLimit=10;
export async function visitorRemaining(identities:string[]) {
  const [row]=await query("select coalesce(max(used),0)::int as used from visitor_usage where identity_hash=any($1) and day=(now() at time zone 'UTC')::date",[identities]);
  return Math.max(0,visitorLimit-row.used);
}
export async function reserveVisitor(identities:string[]) {
  const id=randomUUID();
  return transaction(async client=>{
    for(const identity of [...identities].sort()) {
      const result=await client.query(`insert into visitor_usage(identity_hash,day,used) values($1,(now() at time zone 'UTC')::date,1)
        on conflict(identity_hash,day) do update set used=visitor_usage.used+1 where visitor_usage.used<$2 returning used`,[identity,visitorLimit]);
      if(!result.rows.length) throw new Error('VISITOR_LIMIT');
    }
    await client.query("insert into visitor_requests(id,identities,day,status) values($1,$2,(now() at time zone 'UTC')::date,'reserved')",[id,identities]);
    return id;
  });
}
export async function finishVisitor(id:string,success:boolean) {
  await transaction(async client=>{
    const {rows}=await client.query("update visitor_requests set status=$2 where id=$1 and status='reserved' returning identities,day::text",[id,success?'completed':'refunded']);
    if(!rows[0]||success) return;
    for(const identity of [...rows[0].identities].sort()) await client.query('update visitor_usage set used=greatest(0,used-1) where identity_hash=$1 and day=$2::date',[identity,rows[0].day]);
  });
}
export async function reconcileVisitorUsage() {
  const pending=await query("select id from visitor_requests where status='reserved' and created_at<now()-interval '10 minutes' limit 100");
  for(const row of pending) await finishVisitor(row.id,false);
  await query("delete from visitor_requests where created_at<now()-interval '32 days'");
  await query("delete from visitor_usage where day<(now() at time zone 'UTC')::date-32");
}
