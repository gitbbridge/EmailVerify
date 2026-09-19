import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'

test('workspace team database authorization and lifecycle', { skip: !process.env.DATABASE_URL }, async (t) => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  await db.query('begin')
  try {
    const existing = await db.query("select to_regclass('public.workspace_invitations') as name")
    if (!existing.rows[0].name) await db.query(await readFile(new URL('../supabase/migrations/202609190001_workspace_team.sql', import.meta.url), 'utf8'))
    const workspace = randomUUID(), otherWorkspace = randomUUID()
    const ids = Object.fromEntries(['owner', 'admin', 'member', 'invitee', 'other', 'unverified'].map((name) => [name, randomUUID()]))
    const emails = Object.fromEntries(Object.entries(ids).map(([name, id]) => [name, `${id}@example.invalid`]))
    for (const [name, id] of Object.entries(ids)) {
      await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,'{}')", [id, emails[name], name === 'unverified' ? null : new Date()])
    }
    await db.query("insert into public.workspaces(id,name) values($1,'Team test'),($2,'Other test')", [workspace, otherWorkspace])
    for (const name of ['owner','admin','member']) await db.query('insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,$3)', [workspace, ids[name], name])
    await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'owner')", [otherWorkspace, ids.other])
    const token = () => createHash('sha256').update(randomBytes(32)).digest('hex')
    const mutate = (actor, action, target = null, email = null, role = 'member', hash = null, ws = workspace) => db.query('select public.manage_workspace_team($1,$2,$3,$4,$5,$6,$7) as result', [ws, actor, action, target, email, role, hash])
    const accept = (actor, hash) => db.query('select public.accept_workspace_invitation($1,$2) as result', [actor, hash])
    async function rejected(action, pattern) {
      await db.query('savepoint denied')
      try { await assert.rejects(action, pattern) } finally { await db.query('rollback to savepoint denied') }
    }
    await t.test('member and foreign owner cannot invite', async () => {
      await rejected(() => mutate(ids.member,'invite',null,emails.invitee,'member',token()), /administrator access/)
      await rejected(() => mutate(ids.other,'invite',null,emails.invitee,'member',token()), /administrator access/)
    })
    await t.test('admin cannot appoint admin, change owner, or remove self', async () => {
      await rejected(() => mutate(ids.admin,'invite',null,emails.invitee,'admin',token()), /Only the owner/)
      await rejected(() => mutate(ids.admin,'remove',ids.owner), /cannot change/)
      await rejected(() => mutate(ids.owner,'remove',ids.owner), /cannot change/)
    })
    const hash = token()
    const invite = (await mutate(ids.owner,'invite',null,emails.invitee,'member',hash)).rows[0].result.id
    await t.test('duplicate pending invitations rejected', async () => {
      await rejected(() => mutate(ids.owner,'invite',null,emails.invitee,'member',token()), /already pending/)
    })
    await t.test('wrong email, unknown token, unverified users rejected', async () => {
      await rejected(() => accept(ids.other,hash), /verified email/)
      await rejected(() => accept(ids.invitee,token()), /invalid or expired/)
      const h = token()
      await mutate(ids.owner,'invite',null,emails.unverified,'member',h)
      await rejected(() => accept(ids.unverified,h), /verified email/)
    })
    await t.test('expiration enforced at acceptance', async () => {
      await db.query("update public.workspace_invitations set expires_at=now()-interval '1 second' where id=$1", [invite])
      await rejected(() => accept(ids.invitee,hash), /invalid or expired/)
      await db.query("update public.workspace_invitations set expires_at=now()+interval '7 days' where id=$1", [invite])
    })
    await t.test('acceptance is idempotent and grants no credits or new workspace', async () => {
      const before = (await db.query('select count(*) from public.workspaces')).rows[0].count
      assert.equal((await accept(ids.invitee,hash)).rows[0].result.workspace_id, workspace)
      assert.equal((await accept(ids.invitee,hash)).rows[0].result.workspace_id, workspace)
      assert.equal((await db.query('select count(*) from public.workspaces')).rows[0].count, before)
      assert.equal((await db.query('select count(*) from public.free_credit_claims where user_id=$1', [ids.invitee])).rows[0].count, '0')
      assert.equal((await db.query("select count(*) from public.team_events where workspace_id=$1 and action='joined'", [workspace])).rows[0].count, '1')
    })
    await t.test('existing account cannot move workspaces', async () => {
      await rejected(() => mutate(ids.owner,'invite',null,emails.other,'member',token()), /already belongs/)
    })
    await t.test('role changes and removal revoke member credentials and audit actions', async () => {
      await mutate(ids.owner,'role',ids.invitee,null,'admin')
      const key = randomUUID()
      await db.query("insert into public.api_keys(id,workspace_id,created_by,name,prefix,secret_hash) values($1,$2,$3,'Test','ev_test', $4)", [key,workspace,ids.invitee,token()])
      await mutate(ids.owner,'role',ids.invitee,null,'member')
      assert.ok((await db.query('select revoked_at from public.api_keys where id=$1',[key])).rows[0].revoked_at)
      await mutate(ids.admin,'remove',ids.invitee)
      assert.equal((await db.query('select count(*) from public.workspace_members where user_id=$1',[ids.invitee])).rows[0].count,'0')
      await rejected(() => accept(ids.invitee,hash), /invalid or expired/)
      assert.equal((await db.query("select count(*) from public.team_events where workspace_id=$1 and action='remove'",[workspace])).rows[0].count,'1')
    })
    await t.test('revoked invitation cannot be accepted', async () => {
      const h=token()
      const id=(await mutate(ids.owner,'invite',null,emails.invitee,'member',h)).rows[0].result.id
      await mutate(ids.owner,'revoke',id)
      await rejected(() => accept(ids.invitee,h), /invalid or expired/)
    })
    await t.test('anonymous and authenticated roles have no direct mutation privileges', async () => {
      const result = await db.query("select has_function_privilege('authenticated','public.accept_workspace_invitation(uuid,text)','execute') as accept, has_function_privilege('anon','public.manage_workspace_team(uuid,uuid,text,uuid,text,public.workspace_role,text)','execute') as manage, has_table_privilege('authenticated','public.workspace_invitations','select') as read")
      assert.deepEqual(result.rows[0], { accept:false, manage:false, read:false })
    })
  } finally {
    await db.query('rollback')
    await db.end()
  }
})
