import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
await client.connect()
try {
  await client.query('begin')
  await client.query("select pg_advisory_xact_lock(hashtext('emailverify-team-migration'))")
  const { rows } = await client.query("select to_regclass('public.workspace_invitations') as installed")
  if (!rows[0].installed) {
    await client.query(await readFile(new URL('../supabase/migrations/202609190001_workspace_team.sql', import.meta.url), 'utf8'))
    console.log('Team migration applied.')
  } else console.log('Team migration already applied.')
  await client.query("notify pgrst, 'reload schema'")
  await client.query('commit')
} catch (error) {
  await client.query('rollback')
  throw error
} finally { await client.end() }
