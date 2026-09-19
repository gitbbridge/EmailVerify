import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import pg from 'pg'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  await client.query('begin')
  await client.query("select pg_advisory_xact_lock(hashtext('emailverify-batch-results-migration'))")
  const { rows } = await client.query("select to_regclass('public.batch_results') as installed")
  if (!rows[0].installed) {
    await client.query(await readFile(new URL('../supabase/migrations/202609190003_batch_results.sql', import.meta.url), 'utf8'))
    console.log('Batch results migration applied.')
  } else console.log('Batch results migration already applied.')
  await client.query("notify pgrst, 'reload schema'")
  await client.query('commit')
} catch (error) {
  await client.query('rollback')
  throw error
} finally {
  await client.end()
}
