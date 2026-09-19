import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireSystemAdmin, requireWorkspace } from '../middleware/auth.js'
import { sendSupportAcknowledgement, sendSupportRequestAlert } from '../services/email.js'
import { getSupabaseAdmin } from '../services/supabase.js'

const router = Router()
const createSchema = z.object({
  category: z.enum(['billing', 'verification', 'api', 'account', 'other']),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(5000),
})

router.get('/support/requests', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    const { data, error } = await getSupabaseAdmin().from('support_requests')
      .select('id,category,subject,message,status,priority,created_at,updated_at,resolved_at')
      .eq('workspace_id', request.workspace.id).order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    response.json({ items: data })
  } catch (error) { next(error) }
})

router.post('/support/requests', requireAuth, requireWorkspace, async (request, response, next) => {
  try {
    const input = createSchema.parse(request.body)
    const admin = getSupabaseAdmin()
    const { count, error: countError } = await admin.from('support_requests').select('id', { count: 'exact', head: true })
      .eq('workspace_id', request.workspace.id).in('status', ['open', 'in_progress'])
    if (countError) throw countError
    if ((count || 0) >= 5) {
      const limit = new Error('This workspace already has five active support requests. Please wait for a response before opening another.')
      limit.status = 429
      limit.code = 'support_request_limit'
      throw limit
    }
    const { data, error } = await admin.from('support_requests').insert({
      workspace_id: request.workspace.id,
      user_id: request.auth.user.id,
      ...input,
    }).select('id,category,subject,message,status,priority,created_at,updated_at').single()
    if (error) throw error
    await Promise.allSettled([
      sendSupportRequestAlert({ requestId: data.id, workspaceName: request.workspace.name, email: request.auth.user.email, ...input }),
      sendSupportAcknowledgement({ requestId: data.id, email: request.auth.user.email, subject: input.subject }),
    ])
    response.status(201).json(data)
  } catch (error) { next(error) }
})

router.get('/admin/support/requests', requireAuth, requireSystemAdmin, async (request, response, next) => {
  try {
    const status = z.enum(['open', 'in_progress', 'resolved', 'closed']).optional().parse(request.query.status)
    let query = getSupabaseAdmin().from('support_requests')
      .select('id,workspace_id,user_id,category,subject,message,status,priority,created_at,updated_at,workspaces(name)')
      .order('created_at', { ascending: false }).limit(100)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    response.json({ items: data })
  } catch (error) { next(error) }
})

router.post('/admin/support/requests/:id', requireAuth, requireSystemAdmin, async (request, response, next) => {
  try {
    const id = z.uuid().parse(request.params.id)
    const input = z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'closed']), priority: z.enum(['normal', 'high', 'urgent']) }).parse(request.body)
    const { data, error } = await getSupabaseAdmin().rpc('admin_update_support_request', { p_request_id: id, p_status: input.status, p_priority: input.priority, p_actor_user_id: request.auth.user.id })
    if (error) throw error
    response.json(data)
  } catch (error) { next(error) }
})

export default router
