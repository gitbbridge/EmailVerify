import { Router } from 'express'
import { config } from '../config.js'
import { sendAdminBillingAlert, sendPurchaseConfirmation } from '../services/email.js'
import { getStripe } from '../services/stripe.js'
import { getSupabaseAdmin } from '../services/supabase.js'

const router = Router()

async function fulfillOneTimePurchase(event, session) {
  const admin = getSupabaseAdmin()
  const purchaseId = session.metadata?.purchase_id
  if (!purchaseId) throw new Error('Stripe session is missing purchase metadata.')

  const { data, error } = await admin.rpc('fulfill_checkout_purchase', {
    p_event_id: event.id,
    p_session: session,
  })
  if (error) throw error
  if (!data?.processed) return

  const { data: purchase } = await admin
    .from('purchases')
    .select('id, credits, amount_cents, profiles:user_id(email)')
    .eq('id', purchaseId)
    .single()
  await sendPurchaseConfirmation({
    email: purchase?.profiles?.email,
    purchaseId,
    credits: purchase?.credits || 0,
    amountCents: purchase?.amount_cents || 0,
  })
}

async function recordPaymentRisk(event) {
  const object = event.data.object
  let workspaceId = object.metadata?.workspace_id
  const purchaseId = object.metadata?.purchase_id
  const admin = getSupabaseAdmin()
  if (!workspaceId && object.customer) {
    const { data } = await admin.from('workspaces').select('id').eq('stripe_customer_id', String(object.customer)).maybeSingle()
    workspaceId = data?.id
  }
  if (!workspaceId) return
  const { error } = await admin.from('payment_risk_events').upsert({
    workspace_id: workspaceId,
    stripe_event_id: event.id,
    event_type: event.type,
  }, { onConflict: 'stripe_event_id', ignoreDuplicates: true })
  if (error) throw error
  if (['charge.refunded', 'charge.dispute.created'].includes(event.type)) {
    // Keep the settled purchase immutable; freeze further spending for manual financial reconciliation.
    const { error: freezeError } = await admin.from('workspaces').update({ status: 'suspended' }).eq('id', workspaceId)
    if (freezeError) throw freezeError
  }
  if (purchaseId && event.type === 'charge.refunded') {
    const { error: purchaseError } = await admin.from('purchases')
      .update({ status: 'refunded', updated_at: new Date().toISOString() })
      .eq('id', purchaseId)
      .in('status', ['paid', 'pending'])
    if (purchaseError) throw purchaseError
  }
}

router.post('/', async (request, response) => {
  let event
  try {
    event = getStripe().webhooks.constructEvent(
      request.body,
      request.get('stripe-signature'),
      config.stripeWebhookSecret,
    )
  } catch (error) {
    return response.status(400).json({ error: { code: 'invalid_signature', message: error.message } })
  }

  try {
    if (event.livemode !== config.stripeSecretKey.includes('_live_')) throw new Error('Stripe event mode mismatch.')
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      const session = await getStripe().checkout.sessions.retrieve(event.data.object.id)
      if (session.mode === 'payment' && session.payment_status === 'paid') await fulfillOneTimePurchase(event, session)
    }

    if (event.type === 'checkout.session.expired') {
      const { error } = await getSupabaseAdmin().rpc('release_checkout_reservation', {
        p_purchase_id: event.data.object.metadata?.purchase_id,
      })
      if (error) throw error
    }

    if (['checkout.session.async_payment_failed', 'charge.refunded', 'charge.dispute.created', 'invoice.payment_failed'].includes(event.type)) {
      await recordPaymentRisk(event)
    }

    response.json({ received: true })
  } catch (error) {
    await sendAdminBillingAlert({
      subject: 'EmailVerify Stripe webhook failed',
      text: `Event ${event.id} (${event.type}) failed: ${error.message}`,
      idempotencyKey: `stripe-webhook-failed/${event.id}`,
    }).catch(() => {})
    response.status(500).json({ error: { code: 'webhook_processing_failed', message: 'Webhook processing failed.' } })
  }
})

export default router
