import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { requireAuth, requireWorkspace } from '../middleware/auth.js'
import { sendPasswordReset, sendSignupConfirmation } from '../services/email.js'
import { getSignupFingerprint, hashPrivateIdentifier } from '../services/signupFingerprint.js'
import { createSupabaseAuthClient, getSupabaseAdmin } from '../services/supabase.js'
import { acceptInvitation, inviteTokenSchema } from '../services/team.js'

const router = Router()

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  invitationToken: inviteTokenSchema.optional(),
})

const signupSchema = credentialsSchema.extend({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  workspaceName: z.string().trim().min(1).max(120),
})

function throwAuthError(error) {
  const authError = new Error(error.message || 'Authentication failed.')
  authError.status = error.status || 400
  authError.code = 'authentication_failed'
  throw authError
}

async function bootstrapUser(user, input, request) {
  if (input.invitationToken) return acceptInvitation(user.id, input.invitationToken)
  const admin = getSupabaseAdmin()
  const { data: membership, error: membershipError } = await admin.from('workspace_members').select('workspace_id').eq('user_id', user.id).maybeSingle()
  if (membershipError) throw membershipError
  if (membership) return { workspace_id: membership.workspace_id, created: false }
  const { data: profile, error: profileError } = await admin.from('profiles').select('user_id').eq('user_id', user.id).maybeSingle()
  if (profileError) throw profileError
  if (profile) {
    const removed = new Error('Your workspace access has been removed. Ask the owner for a new invitation.')
    removed.status = 403
    removed.code = 'workspace_access_removed'
    throw removed
  }
  const { data: pending, error: pendingError } = await admin.from('workspace_invitations').select('id')
    .eq('email', user.email.toLowerCase()).is('accepted_at', null).is('revoked_at', null)
    .gt('expires_at', new Date().toISOString()).limit(1)
  if (pendingError) throw pendingError
  if (pending.length) {
    const invitation = new Error('Open the invitation in your email to join your team.')
    invitation.status = 409
    invitation.code = 'invitation_required'
    throw invitation
  }
  const metadata = user.user_metadata || {}
  const fingerprint = getSignupFingerprint(request)
  const { data, error } = await getSupabaseAdmin().rpc('bootstrap_workspace', {
    p_user_id: user.id,
    p_email: user.email,
    p_first_name: input.firstName || metadata.first_name || 'Account',
    p_last_name: input.lastName || metadata.last_name || 'Owner',
    p_workspace_name: input.workspaceName || metadata.workspace_name || 'My Workspace',
    p_ip_hash: fingerprint.ipHash,
    p_network_hash: fingerprint.networkHash,
  })

  if (error) throw error
  if (config.adminEmail && user.email?.toLowerCase() === config.adminEmail.toLowerCase()) {
    const { error: roleError } = await getSupabaseAdmin().from('profiles').update({ system_role: 'admin' }).eq('user_id', user.id)
    if (roleError) throw roleError
  }
  return data
}

router.post('/auth/signup', async (request, response, next) => {
  let createdUserId
  try {
    const input = signupSchema.parse(request.body)
    const admin = getSupabaseAdmin()
    const redirectTo = new URL(config.appUrl)
    if (input.invitationToken) redirectTo.searchParams.set('invitation', input.invitationToken)
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'signup',
      email: input.email,
      password: input.password,
      options: {
        redirectTo: redirectTo.href,
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          workspace_name: input.workspaceName,
        },
      },
    })

    if (error) throwAuthError(error)
    createdUserId = data.user.id
    const fingerprint = getSignupFingerprint(request)
    const { error: originError } = await admin.from('signup_origins').upsert({
      user_id: createdUserId,
      ip_hash: fingerprint.ipHash,
      network_hash: fingerprint.networkHash,
    })
    if (originError) throw originError

    await sendSignupConfirmation({
      email: input.email,
      confirmationUrl: data.properties.action_link,
      userId: createdUserId,
    })

    response.status(201).json({
      session: null,
      requiresEmailConfirmation: true,
    })
  } catch (error) {
    if (createdUserId) await getSupabaseAdmin().auth.admin.deleteUser(createdUserId).catch(() => {})
    next(error)
  }
})

router.post('/auth/login', async (request, response, next) => {
  try {
    const input = credentialsSchema.parse(request.body)
    const { data, error } = await createSupabaseAuthClient().auth.signInWithPassword({ email: input.email, password: input.password })

    if (error) throwAuthError(error)
    if (!input.invitationToken) await bootstrapUser(data.user, {}, request)
    response.json({ session: data.session })
  } catch (error) {
    next(error)
  }
})

router.post('/auth/refresh', async (request, response, next) => {
  try {
    const refreshToken = z.string().min(1).parse(request.body.refreshToken)
    const { data, error } = await createSupabaseAuthClient().auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error) throwAuthError(error)
    response.json({ session: data.session })
  } catch (error) {
    next(error)
  }
})

router.post('/auth/password-reset', async (request, response, next) => {
  try {
    const email = z.email().parse(request.body.email).toLowerCase()
    const admin = getSupabaseAdmin()
    const fingerprint = getSignupFingerprint(request)
    const keys = [`password-reset:email:${hashPrivateIdentifier('email', email)}`]
    if (fingerprint.ipHash) keys.push(`password-reset:ip:${fingerprint.ipHash}`)
    const limits = await Promise.all(keys.map((key, index) => admin.rpc('consume_auth_rate_limit', {
      p_key: key, p_limit: index === 0 ? 3 : 10, p_window_seconds: 900,
    })))
    if (limits.some(({ error }) => error)) throw limits.find(({ error }) => error).error
    if (limits.some(({ data }) => data !== true)) return response.status(202).json({ accepted: true })
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: config.appUrl },
    })

    if (!error && data?.properties?.action_link) {
      try {
        await sendPasswordReset({
          email,
          resetUrl: data.properties.action_link,
          userId: data.user.id,
        })
      } catch (deliveryError) {
        console.error('Password reset delivery failed:', deliveryError.message)
      }
    }
    response.status(202).json({ accepted: true })
  } catch (error) {
    next(error)
  }
})

const passwordUpdateSchema = z.object({
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, 'Password must include a lowercase letter.')
    .regex(/[A-Z]/, 'Password must include an uppercase letter.')
    .regex(/[0-9]/, 'Password must include a number.'),
  refreshToken: z.string().min(1).max(4096),
}).strict()

router.post('/auth/password-update', requireAuth, async (request, response, next) => {
  try {
    const input = passwordUpdateSchema.parse(request.body)
    const auth = createSupabaseAuthClient()
    const { data: sessionData, error: sessionError } = await auth.auth.setSession({
      access_token: request.auth.token,
      refresh_token: input.refreshToken,
    })
    if (sessionError || sessionData.user?.id !== request.auth.user.id) throwAuthError(sessionError || new Error('Recovery session mismatch.'))
    const { error: updateError } = await auth.auth.updateUser({ password: input.password })
    if (updateError) throwAuthError(updateError)
    const { error: signOutError } = await auth.auth.signOut({ scope: 'global' })
    if (signOutError) throwAuthError(signOutError)
    response.json({ updated: true })
  } catch (error) {
    next(error)
  }
})

router.get('/billing/packages', async (_request, response, next) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('packages')
      .select('id, name, credits, retail_price_cents, billing_type, billing_interval, credits_roll_over')
      .eq('active', true)
      .order('sort_order')

    if (error) throw error
    response.json({ items: data })
  } catch (error) {
    next(error)
  }
})

const bootstrapSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  workspaceName: z.string().trim().min(1).max(120),
})

router.post('/auth/workspace-bootstrap', requireAuth, async (request, response, next) => {
  try {
    const input = bootstrapSchema.parse(request.body)
    const data = await bootstrapUser(request.auth.user, input, request)
    response.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

router.post('/auth/complete-signup', requireAuth, async (request, response, next) => {
  try {
    const input = z.object({ invitationToken: inviteTokenSchema.optional() }).parse(request.body || {})
    const data = await bootstrapUser(request.auth.user, input, request)
    response.json(data)
  } catch (error) {
    next(error)
  }
})

router.get('/me', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    const { data: profile, error } = await getSupabaseAdmin()
      .from('profiles')
      .select('first_name, last_name, email, system_role')
      .eq('user_id', request.auth.user.id)
      .single()

    if (error) throw error
    response.json({
      user: { id: request.auth.user.id, ...profile },
      workspace: request.workspace,
    })
  } catch (error) {
    next(error)
  }
})

const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  workspaceName: z.string().trim().min(1).max(120),
})

router.patch('/me', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    const input = profileUpdateSchema.parse(request.body)
    const admin = getSupabaseAdmin()
    if (input.workspaceName !== request.workspace.name && !['owner', 'admin'].includes(request.workspace.role)) {
      const forbidden = new Error('Only workspace owners and administrators can rename the workspace.')
      forbidden.status = 403
      forbidden.code = 'forbidden'
      throw forbidden
    }
    const { error: profileError } = await admin
      .from('profiles')
      .update({ first_name: input.firstName, last_name: input.lastName, updated_at: new Date().toISOString() })
      .eq('user_id', request.auth.user.id)

    if (profileError) throw profileError

    if (input.workspaceName !== request.workspace.name) {
      const { error: workspaceError } = await admin
        .from('workspaces')
        .update({ name: input.workspaceName, updated_at: new Date().toISOString() })
        .eq('id', request.workspace.id)
      if (workspaceError) throw workspaceError
    }

    response.json({
      user: {
        id: request.auth.user.id,
        first_name: input.firstName,
        last_name: input.lastName,
        email: request.auth.user.email,
      },
      workspace: { ...request.workspace, name: input.workspaceName },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/credits', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('credit_accounts')
      .select('available, reserved, updated_at')
      .eq('workspace_id', request.workspace.id)
      .single()

    if (error) throw error
    response.json(data)
  } catch (error) {
    next(error)
  }
})

router.get('/credits/ledger', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(request.query.limit)
    const { data, error } = await getSupabaseAdmin()
      .from('credit_ledger')
      .select('id, type, amount, balance_after, reference_type, reference_id, reason, created_at')
      .eq('workspace_id', request.workspace.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    response.json({ items: data })
  } catch (error) {
    next(error)
  }
})

export default router
