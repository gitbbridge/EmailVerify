import { assertCheckoutEnabled, createCheckout } from '../services/checkout.js'
import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { requireAuth, requireWorkspace } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../services/supabase.js'
import { getStripe } from '../services/stripe.js'

const router = Router()

router.use('/billing', requireAuth, requireWorkspace, (request, response, next) => {
  response.set('Cache-Control', 'no-store')
  if (!['owner', 'admin'].includes(request.workspace.role)) {
    return response.status(403).json({ error: { code: 'forbidden', message: 'Only workspace owners and admins can access billing.' } })
  }
  next()
})

router.get('/billing/summary', async (request, response, next) => {
  try {
    const period = z.enum(['month', 'year']).default('month').parse(request.query.period)
    const { data, error } = await getSupabaseAdmin().rpc('billing_summary', {
      p_workspace_id: request.workspace.id, p_period: period,
    })
    if (error) throw error
    response.json(data)
  } catch (error) { next(error) }
})

router.post('/billing/checkout-sessions', async (request, response, next) => {
  try {
    assertCheckoutEnabled()
    const { packageId } = z.object({ packageId: z.string().min(1).max(80) }).parse(request.body)
    const requestKey = z.uuid().parse(request.get('Idempotency-Key'))
    response.status(201).json(await createCheckout({
      admin: getSupabaseAdmin(), stripe: getStripe(), workspaceId: request.workspace.id,
      userId: request.auth.user.id, userEmail: request.auth.user.email, packageId, requestKey, appUrl: config.appUrl,
    }))
  } catch (error) { next(error) }
})

router.get('/billing/purchases/:id', async (request, response, next) => {
  try {
    const id = z.uuid().parse(request.params.id)
    const { data, error } = await getSupabaseAdmin()
      .from('purchases')
      .select('id, package_id, credits, amount_cents, status, created_at, paid_at')
      .eq('id', id)
      .eq('workspace_id', request.workspace.id)
      .single()
    if (error) throw error
    response.json(data)
  } catch (error) {
    next(error)
  }
})

router.post('/billing/portal-sessions', async (request, response, next) => {
  try {
    const { data: workspace, error } = await getSupabaseAdmin()
      .from('workspaces')
      .select('stripe_customer_id')
      .eq('id', request.workspace.id)
      .single()
    if (error) throw error
    if (!workspace.stripe_customer_id) {
      const missing = new Error('No Stripe customer exists for this workspace.')
      missing.status = 409
      missing.code = 'stripe_customer_required'
      throw missing
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: workspace.stripe_customer_id,
      return_url: `${config.appUrl}/#billing`,
    })
    response.json({ url: portal.url })
  } catch (error) {
    next(error)
  }
})

export default router
