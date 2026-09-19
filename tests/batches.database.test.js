import 'dotenv/config'
import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import { randomUUID } from 'node:crypto'

test('batch results are tenant scoped and read-only to authenticated users', { skip: !process.env.DATABASE_URL }, async (t) => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  await db.query('begin')
  try {
    const installed = await db.query("select to_regclass('public.batch_results') as name")
    assert.equal(installed.rows[0].name, 'batch_results')
    const owner = randomUUID(), other = randomUUID(), workspace = randomUUID(), otherWorkspace = randomUUID(), batch = randomUUID(), otherBatch = randomUUID()
    await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),'{}'),($3,$4,now(),'{}')", [owner, `${owner}@example.invalid`, other, `${other}@example.invalid`])
    await db.query("insert into public.workspaces(id,name) values($1,'Results test'),($2,'Other results test')", [workspace, otherWorkspace])
    await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner'),($3,$4,'owner')", [workspace, owner, otherWorkspace, other])
    await db.query("insert into public.batches(id,workspace_id,user_id,name,status,total) values($1,$2,$3,'Owned batch','complete',1),($4,$5,$6,'Other batch','complete',1)", [batch, workspace, owner, otherBatch, otherWorkspace, other])
    await db.query("insert into public.batch_results(batch_id,workspace_id,row_number,email,state,score) values($1,$2,1,'owner@example.com','deliverable',100),($3,$4,1,'other@example.com','risky',42)", [batch, workspace, otherBatch, otherWorkspace])
    await db.query('savepoint duplicate')
    await assert.rejects(db.query("insert into public.batch_results(batch_id,workspace_id,row_number,email,state) values($1,$2,1,'duplicate@example.com','unknown')", [batch, workspace]), /duplicate key|unique constraint/i)
    await db.query('rollback to savepoint duplicate')
    const privileges = await db.query("select has_table_privilege('anon','public.batch_results','insert') as anon_insert, has_table_privilege('authenticated','public.batch_results','insert') as auth_insert")
    assert.deepEqual(privileges.rows[0], { anon_insert: false, auth_insert: false })
    await db.query("set local role authenticated")
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner])
    const visible = await db.query('select email from public.batch_results order by email')
    assert.deepEqual(visible.rows, [{ email: 'owner@example.com' }])
  } finally {
    await db.query('rollback')
    await db.end()
  }
})
