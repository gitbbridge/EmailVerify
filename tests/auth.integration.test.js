import 'dotenv/config'
import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'

const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)

test('real recovery session changes password and revokes existing sessions', { skip: !configured, timeout: 30000 }, async () => {
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false, autoRefreshToken:false } })
  const auth = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession:false, autoRefreshToken:false } })
  const email = `recovery-test-${crypto.randomUUID()}@example.invalid`
  const oldPassword = 'OriginalPassword2026'
  const newPassword = 'ReplacementPassword2026'
  let userId
  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password:oldPassword, email_confirm:true })
    if (createError) throw createError
    userId = created.user.id
    const originalLogin = await auth().auth.signInWithPassword({ email, password:oldPassword })
    if (originalLogin.error) throw originalLogin.error
    const oldRefreshToken = originalLogin.data.session.refresh_token

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type:'recovery', email, options:{ redirectTo:'http://127.0.0.1:5173' } })
    if (linkError) throw linkError
    const verification = await fetch(link.properties.action_link, { redirect:'manual' })
    const location = verification.headers.get('location')
    assert.ok(location, 'Supabase recovery verification did not return a redirect.')
    const params = new URLSearchParams(new URL(location).hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    assert.ok(accessToken && refreshToken, 'Recovery redirect did not contain a session.')

    const update = await fetch('http://127.0.0.1:8787/api/v1/auth/password-update', {
      method:'POST', headers:{ Authorization:`Bearer ${accessToken}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ password:newPassword, refreshToken }),
    })
    assert.equal(update.status,200,await update.text())
    assert.ok((await auth().auth.signInWithPassword({ email, password:oldPassword })).error, 'Old password still works.')
    assert.equal((await auth().auth.signInWithPassword({ email, password:newPassword })).error,null)
    assert.ok((await auth().auth.refreshSession({ refresh_token:oldRefreshToken })).error, 'Previous refresh token still works.')
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId)
  }
})
