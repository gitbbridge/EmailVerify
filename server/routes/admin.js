import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireSystemAdmin } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../services/supabase.js'

const router = Router()

router.get('/admin/overview', requireAuth, requireSystemAdmin, async (_request, response, next) => {
  try {
    const admin = getSupabaseAdmin()
    const [inventory, workspaces, users, approvals, failedPayments] = await Promise.all([
      admin.from('provider_inventory').select('*').eq('provider', 'emailable').single(),
      admin.from('workspaces').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('user_id', { count: 'exact', head: true }),
      admin.from('batches').select('id', { count: 'exact', head: true }).eq('status', 'approval_pending'),
      admin.from('payment_risk_events').select('id', { count: 'exact', head: true }),
    ])
    for (const result of [inventory, workspaces, users, approvals, failedPayments]) if (result.error) throw result.error
    const item = inventory.data
    const sellable = Math.max(0, Math.min(item.sales_allocation - item.allocated_to_customers - item.pending_checkout, item.reported_available - item.safety_reserve - item.allocated_to_customers - item.pending_checkout))
    response.json({ inventory: { ...item, sellable }, counts: { workspaces: workspaces.count, users: users.count, approvals: approvals.count, payment_risks: failedPayments.count } })
  } catch (error) { next(error) }
})

router.get('/admin/workspaces', requireAuth, requireSystemAdmin, async (request, response, next) => {
  try {
    const search = z.string().trim().max(100).default('').parse(request.query.search)
    let query = getSupabaseAdmin().from('workspaces').select('id,name,status,stripe_customer_id,created_at,credit_accounts(available,reserved)').order('created_at', { ascending: false }).limit(50)
    if (search) query = query.ilike('name', `%${search.replaceAll('%', '')}%`)
    const { data, error } = await query
    if (error) throw error
    response.json({ items: data })
  } catch (error) { next(error) }
})

router.get('/admin/workspaces/:id', requireAuth, requireSystemAdmin, async (request, response, next) => {
  try {
    const id = z.uuid().parse(request.params.id)
    const admin = getSupabaseAdmin()
    const [workspace, members, purchases, ledger, actions] = await Promise.all([
      admin.from('workspaces').select('id,name,status,stripe_customer_id,created_at,credit_accounts(available,reserved)').eq('id', id).single(),
      admin.from('workspace_members').select('user_id,role').eq('workspace_id', id),
      admin.from('purchases').select('id,package_id,credits,amount_cents,status,created_at,paid_at').eq('workspace_id', id).order('created_at', { ascending: false }).limit(20),
      admin.from('credit_ledger').select('id,type,amount,balance_after,reason,created_at').eq('workspace_id', id).order('created_at', { ascending: false }).limit(30),
      admin.from('admin_actions').select('id,action,reason,metadata,created_at').eq('workspace_id', id).order('created_at', { ascending: false }).limit(20),
    ])
    for (const result of [workspace, members, purchases, ledger, actions]) if (result.error) throw result.error
    const userIds = members.data.map((item) => item.user_id)
    const profiles = userIds.length ? await admin.from('profiles').select('user_id,first_name,last_name,email').in('user_id', userIds) : { data: [], error: null }
    if (profiles.error) throw profiles.error
    response.json({ workspace: workspace.data, members: members.data.map((member) => ({ ...member, profile: profiles.data.find((profile) => profile.user_id === member.user_id) })), purchases: purchases.data, ledger: ledger.data, actions: actions.data })
  } catch (error) { next(error) }
})

router.post('/admin/workspaces/:id/credit-adjustments', requireAuth, requireSystemAdmin, async (request, response, next) => {
  try {
    const id = z.uuid().parse(request.params.id)
    const input = z.object({ amount: z.number().int().min(-1000000).max(1000000).refine((value) => value !== 0), reason: z.string().trim().min(10).max(500) }).parse(request.body)
    const { data, error } = await getSupabaseAdmin().rpc('admin_adjust_credits', { p_workspace_id: id, p_amount: input.amount, p_reason: input.reason, p_actor_user_id: request.auth.user.id })
    if (error) throw error
    response.json(data)
  } catch (error) { next(error) }
})

router.post('/admin/workspaces/:id/status', requireAuth, requireSystemAdmin, async (request, response, next) => {
  try {
    const id = z.uuid().parse(request.params.id)
    const input = z.object({ status: z.enum(['active', 'suspended']), reason: z.string().trim().min(10).max(500) }).parse(request.body)
    const { data, error } = await getSupabaseAdmin().rpc('admin_set_workspace_status', { p_workspace_id: id, p_status: input.status, p_reason: input.reason, p_actor_user_id: request.auth.user.id })
    if (error) throw error
    response.json(data)
  } catch (error) { next(error) }
})

export default router
