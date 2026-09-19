import { createHash } from 'node:crypto'
import { z } from 'zod'
import { getSupabaseAdmin } from './supabase.js'

export const inviteTokenSchema = z.string().regex(/^[a-f0-9]{64}$/)
export function hashInviteToken(token) {
  return createHash('sha256').update(inviteTokenSchema.parse(token)).digest('hex')
}

export function teamError(error) {
  if (['42501', 'P0001', '23505'].includes(error.code)) {
    const mapped = new Error(error.code === '23505' ? 'This invitation or membership already exists.' : error.message)
    mapped.status = error.code === '42501' ? 403 : 409
    mapped.code = 'team_request_failed'
    return mapped
  }
  return error
}

export async function acceptInvitation(userId, token) {
  const { data, error } = await getSupabaseAdmin().rpc('accept_workspace_invitation', {
    p_actor: userId, p_token_hash: hashInviteToken(token),
  })
  if (error) throw teamError(error)
  return data
}
