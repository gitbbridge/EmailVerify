import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
await db.connect()
try {
  await db.query('begin')
  await db.query("select pg_advisory_xact_lock(hashtext('emailverify-import-idempotency'))")
  const { rows } = await db.query("select 1 from information_schema.columns where table_schema='public' and table_name='batches' and column_name='request_key'")
  if (!rows.length) await db.query(await readFile(new URL('../supabase/migrations/202609220001_batch_import_idempotency.sql', import.meta.url), 'utf8'))
  await db.query("notify pgrst, 'reload schema'")
  await db.query('commit')
  console.log('Import idempotency migration ready.')
} catch (error) { await db.query('rollback'); throw error }
finally { await db.end() }
