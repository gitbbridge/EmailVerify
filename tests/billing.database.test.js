import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

test('billing aggregates all settled entries, isolates tenants and restricts execution', async () => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  await db.query('begin')
  try {
    const workspace = randomUUID(), other = randomUUID(), apiKey = randomUUID(), verification = randomUUID()
    const owner = randomUUID(), member = randomUUID()
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}'),($3,$4,'{}')", [owner, `${owner}@example.invalid`, member, `${member}@example.invalid`])
    await db.query("insert into profiles(user_id,first_name,last_name,email) values($1,'Test','Owner',$2) on conflict do nothing", [owner, `${owner}@example.invalid`])
    await db.query("insert into workspaces(id,name) values($1,'Billing test'),($2,'Other tenant')", [workspace, other])
    await db.query('insert into credit_accounts(workspace_id,available,reserved) values($1,700,30)', [workspace])
    await db.query("insert into workspace_members(workspace_id,user_id,role) values($1,$2,'owner'),($1,$3,'member')", [workspace, owner, member])
    await db.query("insert into purchases(id,workspace_id,user_id,package_id,credits,amount_cents,status) select gen_random_uuid(),$1,$2,'credits_5k',5000,1400,'paid' from generate_series(1,21)", [workspace, owner])
    await db.query("insert into purchases(id,workspace_id,user_id,package_id,credits,amount_cents,status) values(gen_random_uuid(),$1,$2,'credits_5k',5000,1400,'failed')", [other, owner])
    await db.query("insert into api_keys(id,workspace_id,name,secret_hash,prefix,environment) values($1,$2,'Test',$3,'ev_test','test')", [apiKey, workspace, apiKey])
    await db.query("insert into verification_requests(id,workspace_id,request_key,email_hash,email_masked,api_key_id) values($1,$2,'key','hash','a***@example.invalid',$3)", [verification, workspace, apiKey])
    await db.query("insert into credit_ledger(workspace_id,type,amount,balance_after,reference_type) select $1,'consume',-1,700,'batch' from generate_series(1,1005)", [workspace])
    await db.query("insert into credit_ledger(workspace_id,type,amount,balance_after,reference_type,reference_id) values($1,'consume',-1,700,'verification',$2),($1,'consume',-1,700,'verification','single'),($1,'consume',-2,700,'custom',null),($1,'reserve',0,700,'batch',null),($1,'release',0,700,'batch',null),($1,'signup_grant',1000,1000,'signup',null),($3,'consume',-99,0,'batch',null)", [workspace, verification, other])
    await db.query("insert into credit_ledger(workspace_id,type,amount,balance_after,reference_type,created_at) values($1,'consume',-77,700,'batch',now()-interval '2 years')", [workspace])
    const summary = async (id, period) => (await db.query('select billing_summary($1,$2) as result', [id, period])).rows[0].result
    const result = await summary(workspace, 'month')
    assert.equal(result.available, 700)
    assert.equal(result.reserved, 30)
    assert.equal(result.lastAdded.credits, 1000)
    assert.equal(result.portalAvailable, false)
    assert.equal(result.purchases.length, 20)
    assert.ok(result.purchases.every((row) => row.status === 'paid'))
    assert.equal(result.buckets.length, 30)
    const total = (key) => result.buckets.reduce((sum, row) => sum + row[key], 0)
    assert.equal(total('bulk'), 1005)
    assert.equal(total('api'), 1)
    assert.equal(total('single'), 1)
    assert.equal(total('other'), 2)
    assert.equal((await summary(workspace, 'year')).buckets.length, 12)
    assert.equal((await summary(other, 'month')).buckets.reduce((sum, row) => sum + row.bulk, 0), 99)
    const empty = await summary(randomUUID(), 'month')
    assert.equal(empty.available, null)
    assert.equal(empty.lastAdded, null)
    assert.deepEqual(empty.purchases, [])
    assert.equal(empty.buckets.reduce((sum, row) => sum + row.bulk, 0), 0)
    const privileges = (await db.query("select has_function_privilege('anon','billing_summary(uuid,text)','execute') as anon,has_function_privilege('authenticated','billing_summary(uuid,text)','execute') as authenticated,has_function_privilege('service_role','billing_summary(uuid,text)','execute') as service")).rows[0]
    assert.deepEqual(privileges, { anon: false, authenticated: false, service: true })
    await db.query('set local role authenticated')
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
    assert.equal((await db.query('select id from purchases')).rows.length, 21)
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [member])
    assert.equal((await db.query('select id from purchases')).rows.length, 0)
    await db.query('reset role')
    await assert.rejects(db.query("select billing_summary($1,'invalid')", [workspace]), /Invalid billing period/)
  } finally { await db.query('rollback'); await db.end() }
})
