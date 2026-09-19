import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireWorkspace } from '../middleware/auth.js'
import { generateApiKey } from '../services/apiKeys.js'
import { getSupabaseAdmin } from '../services/supabase.js'

const router = Router()

function requireWorkspaceAdmin(request, _response, next) {
  if (!['owner', 'admin'].includes(request.workspace.role)) {
    const error = new Error('Workspace administrator access is required.')
    error.status = 403
    error.code = 'forbidden'
    return next(error)
  }
  next()
}

router.get('/api-keys', requireAuth, requireWorkspace, requireWorkspaceAdmin, async (request, response, next) => {
  try {
    const { data, error } = await getSupabaseAdmin().from('api_keys')
      .select('id,name,prefix,environment,last_used_at,revoked_at,created_at')
      .eq('workspace_id', request.workspace.id).order('created_at', { ascending: false })
    if (error) throw error
    response.json({ items: data })
  } catch (error) { next(error) }
})

router.post('/api-keys', requireAuth, requireWorkspace, requireWorkspaceAdmin, async (request, response, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(1).max(80), environment: z.enum(['live', 'test']).default('live') }).parse(request.body)
    const generated = generateApiKey(input.environment)
    const { data, error } = await getSupabaseAdmin().from('api_keys').insert({
      workspace_id: request.workspace.id,
      created_by: request.auth.user.id,
      name: input.name,
      prefix: generated.prefix,
      secret_hash: generated.secretHash,
      environment: input.environment,
    }).select('id,name,prefix,environment,last_used_at,revoked_at,created_at').single()
    if (error) throw error
    response.status(201).json({ ...data, secret: generated.secret })
  } catch (error) { next(error) }
})

router.delete('/api-keys/:id', requireAuth, requireWorkspace, requireWorkspaceAdmin, async (request, response, next) => {
  try {
    const id = z.uuid().parse(request.params.id)
    const { data, error } = await getSupabaseAdmin().from('api_keys')
      .update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', request.workspace.id)
      .is('revoked_at', null).select('id').maybeSingle()
    if (error) throw error
    if (!data) {
      const missing = new Error('API key not found or already revoked.')
      missing.status = 404
      missing.code = 'api_key_not_found'
      throw missing
    }
    response.status(204).send()
  } catch (error) { next(error) }
})

router.get('/api-keys/usage/summary', requireAuth, requireWorkspace, requireWorkspaceAdmin, async (request, response, next) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await getSupabaseAdmin().rpc('get_api_usage_summary', { p_workspace_id: request.workspace.id, p_since: since })
    if (error) throw error
    response.json(data)
  } catch (error) { next(error) }
})

export default router
