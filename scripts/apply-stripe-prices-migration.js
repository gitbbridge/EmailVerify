import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
try {
  await db.query('begin')
  await db.query("select pg_advisory_xact_lock(hashtext('stripe-price-modes-migration'))")
  await db.query(await readFile(new URL('../supabase/migrations/202609220004_stripe_price_modes.sql', import.meta.url), 'utf8'))
  await db.query("notify pgrst, 'reload schema'")
  await db.query('commit')
  console.log('Stripe price mode migration ready.')
} catch (error) { await db.query('rollback'); throw error }
finally { await db.end() }
