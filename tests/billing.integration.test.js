import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import router from '../server/routes/billing.js'
import { getSupabaseAdmin, createSupabaseAuthClient } from '../server/services/supabase.js'
import { errorHandler } from '../server/middleware/errorHandler.js'

test('billing HTTP authenticates and enforces workspace roles without contacting Stripe', { timeout: 60000 }, async () => {
  const admin = getSupabaseAdmin(), users = [], workspaces = []
  const unwrap = ({ data, error }) => { if (error) throw error; return data }
  const app = express()
  app.use(express.json(), router, errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const request = (path, token, method = 'GET') => fetch(`${base}/billing/${path}`, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} })
  try {
    assert.equal((await request('summary')).status, 401)
    const email = `billing-${randomUUID()}@example.invalid`, password = `Test9-${randomUUID()}`
    const { user } = unwrap(await admin.auth.admin.createUser({ email, password, email_confirm: true }))
    users.push(user.id)
    const workspace = unwrap(await admin.from('workspaces').insert({ name: 'Billing HTTP test' }).select().single())
    workspaces.push(workspace.id)
    unwrap(await admin.from('workspace_members').insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' }))
    const { session } = unwrap(await createSupabaseAuthClient().auth.signInWithPassword({ email, password }))
    const token = session.access_token
    const response = await request('summary', token)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal((await response.json()).buckets.length, 30)
    assert.equal((await request('summary?period=invalid', token)).status, 400)
    assert.equal((await request('portal-sessions', token, 'POST')).status, 409)
    unwrap(await admin.from('workspace_members').update({ role: 'admin' }).eq('user_id', user.id))
    assert.equal((await request('summary', token)).status, 200)
    unwrap(await admin.from('workspace_members').update({ role: 'member' }).eq('user_id', user.id))
    for (const [path, method] of [['summary','GET'],['portal-sessions','POST'],['checkout-sessions','POST'],[`purchases/${randomUUID()}`,'GET']]) {
      assert.equal((await request(path, token, method)).status, 403)
    }
    unwrap(await admin.from('workspace_members').delete().eq('user_id', user.id))
    assert.equal((await request('summary', token)).status, 409)
  } finally {
    for (const id of workspaces) unwrap(await admin.from('workspaces').delete().eq('id', id))
    for (const id of users) unwrap(await admin.auth.admin.deleteUser(id))
    await new Promise((resolve) => server.close(resolve))
  }
})
