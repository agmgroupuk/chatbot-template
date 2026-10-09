import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const globalDatabase = globalThis as unknown as { databasePool?: Pool };
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured.');
  if (!globalDatabase.databasePool) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
    pool.on('error',()=>console.error('An idle database connection was interrupted.'));
    globalDatabase.databasePool=pool;
  }
  return globalDatabase.databasePool;
}
export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  return (await database().query<T>(sql, values)).rows;
}
export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await database().connect();
  try { await client.query('begin'); const result = await work(client); await client.query('commit'); return result; }
  catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
// Each connection is scoped inside a transaction; pool reuse cannot leak identity.
export async function ownedQuery<T extends QueryResultRow = QueryResultRow>(userId: string, sql: string, values: unknown[] = []) {
  return transaction(async client => {
    await client.query('set local role app_user');
    await client.query("select set_config('app.user_id',$1,true)", [userId]);
    return (await client.query<T>(sql,values)).rows;
  });
}
