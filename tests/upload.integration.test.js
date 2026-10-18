import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import { getSupabaseAdmin, createSupabaseAuthClient } from '../server/services/supabase.js'
import { createBatchUploadRouter } from '../server/routes/batchUpload.js'
import { startBatch } from '../server/services/batchSettlement.js'
import { errorHandler } from '../server/middleware/errorHandler.js'

test('authenticated imports persist privately and replay once per workspace', { timeout: 60000 }, async () => {
  const admin = getSupabaseAdmin()
  const users = [], workspaces = []
  let notices = 0
  const app = express()
  app.use('/api/v1', createBatchUploadRouter({ submitBatch: (input) => startBatch(input, { notifyApproval: async () => { notices++ } }) }))
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const unwrap = ({ data, error }) => { if (error) throw error; return data }
  try {
    const identities = []
    for (let i = 0; i < 2; i++) {
      const email = `import-${randomUUID()}@example.invalid`, password = `ImportTest9-${randomUUID()}`
      const { user } = unwrap(await admin.auth.admin.createUser({ email, password, email_confirm: true }))
      users.push(user.id)
      const workspace = unwrap(await admin.from('workspaces').insert({ name: `Import test ${randomUUID()}` }).select().single())
      workspaces.push(workspace.id)
      unwrap(await admin.from('workspace_members').insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' }))
      const auth = createSupabaseAuthClient()
      const { session } = unwrap(await auth.auth.signInWithPassword({ email, password }))
      identities.push({ auth, token: session.access_token, workspace: workspace.id, userId: user.id })
    }
    const key = randomUUID()
    const send = async (identity, text = 'Email\nA@example.com\na@example.com\nb@example.com', requestKey = key) => {
      const body = new FormData()
      body.append('file', new Blob([text], { type: 'text/csv' }), 'test.csv')
      const response = await fetch(`${base}/api/v1/batches/upload`, { method: 'POST', headers: { Authorization: `Bearer ${identity.token}`, 'Idempotency-Key': requestKey }, body })
      return { status: response.status, body: await response.json() }
    }
    const first = await send(identities[0])
    assert.equal(first.status, 202, JSON.stringify(first.body))
    assert.equal(first.body.status, 'approval_pending')
    assert.equal(first.body.total, 2)
    assert.equal(first.body.duplicates_removed, 1)
    const replay = await send(identities[0])
    assert.equal(replay.body.id, first.body.id)
    assert.equal(replay.body.replayed, true)
    assert.equal(notices, 1)
    assert.equal((await send(identities[0], 'changed@example.com')).status, 409)
    assert.equal((await send(identities[0], 'Email\ninvalid', randomUUID())).status, 400)
    const rows = unwrap(await admin.from('batches').select('*').eq('workspace_id', identities[0].workspace))
    assert.equal(rows.length, 1)
    const stored = unwrap(await admin.storage.from('batch-submissions').download(rows[0].submission_path))
    assert.deepEqual(JSON.parse(await stored.text()), ['a@example.com', 'b@example.com'])
    const foreign = await identities[1].auth.from('batches').select('id').eq('id', first.body.id)
    assert.ok(foreign.error || foreign.data.length === 0)
    assert.ok((await identities[1].auth.storage.from('batch-submissions').download(rows[0].submission_path)).error)
    const ledger = unwrap(await admin.from('credit_ledger').select('id').eq('workspace_id', identities[0].workspace))
    assert.equal(ledger.length, 0, 'Approval-pending import must not reserve credits')
    const other = await send(identities[1])
    assert.equal(other.status, 202)
    assert.notEqual(other.body.id, first.body.id, 'Request keys are scoped to workspace')
    const concurrentKey = randomUUID()
    const submissions = await Promise.all(Array.from({ length: 3 }, () => startBatch({
      workspaceId: identities[0].workspace, userId: identities[0].userId, networkHash: null,
      name: 'Concurrent import', emails: ['concurrent@example.com'], requestKey: concurrentKey,
    }, { notifyApproval: async () => { notices++ } })))
    assert.equal(new Set(submissions.map((item) => item.id)).size, 1)
    assert.equal(notices, 3, 'Exactly one approval notification per unique import')
    const objects = unwrap(await admin.storage.from('batch-submissions').list(identities[0].workspace))
    assert.equal(objects.length, 2, 'Concurrent losing requests remove their private files')
    unwrap(await admin.from('workspace_members').delete().eq('workspace_id', identities[0].workspace).eq('user_id', identities[0].userId))
    assert.equal((await send(identities[0])).status, 409, 'Removed members cannot upload')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    for (const id of workspaces) {
      const rows = unwrap(await admin.from('batches').select('submission_path').eq('workspace_id', id))
      const paths = rows.map((row) => row.submission_path).filter(Boolean)
      if (paths.length) unwrap(await admin.storage.from('batch-submissions').remove(paths))
      unwrap(await admin.from('workspaces').delete().eq('id', id))
    }
    for (const id of users) unwrap(await admin.auth.admin.deleteUser(id))
  }
})
