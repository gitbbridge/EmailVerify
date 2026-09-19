import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireWorkspace } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../services/supabase.js'
import { sendTeamInvitation } from '../services/email.js'
import { config } from '../config.js'
import { hashInviteToken, teamError } from '../services/team.js'

const router = Router()
router.use('/team', requireAuth, requireWorkspace)

router.get('/team', async (request, response, next) => {
  try {
    const db = getSupabaseAdmin()
    const workspaceId = request.workspace.id
    const { data: members, error } = await db.from('workspace_members')
      .select('user_id, role, created_at').eq('workspace_id', workspaceId).order('created_at')
    if (error) throw error
    const { data: profiles, error: profileError } = await db.from('profiles')
      .select('user_id, first_name, last_name, email').in('user_id', members.map((member) => member.user_id))
    if (profileError) throw profileError
    let invitations = [], events = []
    if (['owner', 'admin'].includes(request.workspace.role)) {
      const { data, error: inviteError } = await db.from('workspace_invitations')
        .select('id, email, role, expires_at, created_at').eq('workspace_id', workspaceId)
        .is('accepted_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
      if (inviteError) throw inviteError
      invitations = data
      const { data: activity, error: eventError } = await db.from('team_events')
        .select('id, action, subject, actor_user_id, created_at').eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }).limit(50)
      if (eventError) throw eventError
      events = activity
    }
    response.json({ members: members.map((member) => ({ ...member, profile: profiles.find((profile) => profile.user_id === member.user_id) })), invitations, events })
  } catch (error) { next(error) }
})

async function mutate(request, args) {
  const { data, error } = await getSupabaseAdmin().rpc('manage_workspace_team', {
    p_workspace_id: request.workspace.id, p_actor: request.auth.user.id, ...args,
  })
  if (error) throw teamError(error)
  return data
}

router.post('/team/invitations', async (request, response, next) => {
  try {
    const input = z.object({ email: z.email().max(254).transform((value) => value.toLowerCase()), role: z.enum(['member', 'admin']) }).strict().parse(request.body)
    const token = randomBytes(32).toString('hex')
    const invitation = await mutate(request, { p_action: 'invite', p_email: input.email, p_role: input.role, p_token_hash: hashInviteToken(token) })
    const url = new URL(config.appUrl)
    url.searchParams.set('invitation', token)
    try {
      await sendTeamInvitation({ email: input.email, workspaceName: request.workspace.name, role: input.role, invitationId: invitation.id, invitationUrl: url.href })
    } catch (error) {
      // Never leave an inaccessible pending invite that prevents the sender retrying.
      const { error: revokeError } = await getSupabaseAdmin().from('workspace_invitations')
        .update({ revoked_at: new Date().toISOString() }).eq('id', invitation.id).eq('workspace_id', request.workspace.id).is('accepted_at', null)
      if (revokeError) throw revokeError
      throw error
    }
    response.status(201).json({ id: invitation.id })
  } catch (error) { next(error) }
})

router.delete('/team/invitations/:id', async (request, response, next) => {
  try {
    await mutate(request, { p_action: 'revoke', p_target: z.uuid().parse(request.params.id) })
    response.json({ revoked: true })
  } catch (error) { next(error) }
})

router.patch('/team/members/:id', async (request, response, next) => {
  try {
    const input = z.object({ role: z.enum(['admin', 'member']) }).strict().parse(request.body)
    await mutate(request, { p_action: 'role', p_target: z.uuid().parse(request.params.id), p_role: input.role })
    response.json({ updated: true })
  } catch (error) { next(error) }
})

router.delete('/team/members/:id', async (request, response, next) => {
  try {
    await mutate(request, { p_action: 'remove', p_target: z.uuid().parse(request.params.id) })
    response.json({ removed: true })
  } catch (error) { next(error) }
})

export default router
