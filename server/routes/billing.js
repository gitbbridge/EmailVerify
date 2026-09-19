import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { requireAuth, requireWorkspace } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../services/supabase.js'
import { getStripe } from '../services/stripe.js'

const router = Router()

router.post('/billing/checkout-sessions', requireAuth, requireWorkspace, async (request, response, next) => {
  const purchaseId = randomUUID()

  try {
    const { packageId } = z.object({ packageId: z.string().min(1).max(80) }).parse(request.body)
    const admin = getSupabaseAdmin()
    const { data: packageItem, error: packageError } = await admin
      .from('packages')
      .select('id, name, credits, retail_price_cents, billing_type, stripe_price_id, active')
      .eq('id', packageId)
      .eq('active', true)
      .single()

    if (packageError) throw packageError
    if (!packageItem.stripe_price_id) {
      const error = new Error('This package is not available for checkout yet.')
      error.status = 409
      error.code = 'package_not_configured'
      throw error
    }
    if (packageItem.billing_type === 'subscription') {
      const error = new Error('Monthly checkout is being finalized and is not available yet.')
      error.status = 409
      error.code = 'subscriptions_not_enabled'
      throw error
    }

    const { error: reservationError } = await admin.rpc('create_checkout_reservation', {
      p_purchase_id: purchaseId,
      p_workspace_id: request.workspace.id,
      p_package_id: packageItem.id,
      p_user_id: request.auth.user.id,
    })
    if (reservationError) throw reservationError

    const mode = packageItem.billing_type === 'subscription' ? 'subscription' : 'payment'
    const metadata = {
      purchase_id: purchaseId,
      workspace_id: request.workspace.id,
      package_id: packageItem.id,
    }
    const session = await getStripe().checkout.sessions.create({
      mode,
      customer_email: request.auth.user.email,
      line_items: [{ price: packageItem.stripe_price_id, quantity: 1 }],
      metadata,
      ...(mode === 'subscription' ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
      success_url: `${config.appUrl}/?checkout=success&purchase=${purchaseId}`,
      cancel_url: `${config.appUrl}/?checkout=cancelled`,
    })

    const { error: updateError } = await admin
      .from('purchases')
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', purchaseId)
    if (updateError) throw updateError

    response.status(201).json({ id: purchaseId, checkoutUrl: session.url })
  } catch (error) {
    try {
      await getSupabaseAdmin().rpc('release_checkout_reservation', { p_purchase_id: purchaseId })
    } catch {
      // The reservation may not exist if checkout failed before the database write.
    }
    next(error)
  }
})

router.get('/billing/purchases/:id', requireAuth, requireWorkspace, async (request, response, next) => {
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

router.post('/billing/portal-sessions', requireAuth, requireWorkspace, async (request, response, next) => {
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
      return_url: `${config.appUrl}/`,
    })
    response.json({ url: portal.url })
  } catch (error) {
    next(error)
  }
})

export default router
