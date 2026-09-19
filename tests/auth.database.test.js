import 'dotenv/config'
import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'

test('password reset rate limiting is atomic and isolated', { skip: !process.env.DATABASE_URL }, async (t) => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  const key = `test:password-reset:${crypto.randomUUID()}`
  const consume = (limit = 3, seconds = 900) => db.query('select public.consume_auth_rate_limit($1,$2,$3) as allowed', [key,limit,seconds]).then(({ rows }) => rows[0].allowed)
  try {
    await t.test('allows only the configured attempts within a window', async () => {
      const attempts = await Promise.all(Array.from({ length: 5 }, async () => {
        const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
        await client.connect()
        try { return (await client.query('select public.consume_auth_rate_limit($1,3,900) as allowed',[key])).rows[0].allowed }
        finally { await client.end() }
      }))
      assert.equal(attempts.filter(Boolean).length,3)
    })
    await t.test('a separate identifier has an independent allowance', async () => {
      const { rows } = await db.query('select public.consume_auth_rate_limit($1,1,900) as allowed', [`${key}:other`])
      assert.equal(rows[0].allowed,true)
    })
    await t.test('expired windows reset atomically', async () => {
      await db.query("update public.auth_rate_limits set window_started_at=now()-interval '1 hour' where key=$1",[key])
      assert.equal(await consume(3,900),true)
      assert.equal((await db.query('select attempts from public.auth_rate_limits where key=$1',[key])).rows[0].attempts,1)
    })
    await t.test('clients cannot access rate-limit state or function directly', async () => {
      const { rows } = await db.query("select has_table_privilege('authenticated','public.auth_rate_limits','select') as read, has_function_privilege('anon','public.consume_auth_rate_limit(text,integer,integer)','execute') as consume")
      assert.deepEqual(rows[0],{read:false,consume:false})
    })
  } finally { await db.query('delete from public.auth_rate_limits where key like $1',[`${key}%`]); await db.end() }
})
