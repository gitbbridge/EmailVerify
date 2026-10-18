import { config } from '../config.js'

function conflict(message) { return Object.assign(new Error(message), { status: 409, code: 'checkout_unavailable' }) }
export function assertCheckoutEnabled(settings = config) {
  if (settings.stripeSecretKey.includes('_live_') && (!settings.stripeLiveEnabled || !settings.appUrl.startsWith('https://'))) {
    throw conflict('Live payments are not enabled. Complete the Stripe launch checklist first.')
  }
}

export async function ensureStripeCustomer(admin, stripe, workspaceId, email) {
  const read = async () => {
    const { data, error } = await admin.from('workspaces').select('stripe_customer_id,name').eq('id', workspaceId).single()
    if (error) throw error
    return data
  }
  const existing = await read()
  if (existing.stripe_customer_id) return existing.stripe_customer_id
  // Stable parameters allow parallel owners and retries to reuse one Stripe operation.
  const workspace = await read()
  const customer = await stripe.customers.create({ email, name: workspace.name, metadata: { workspace_id: workspaceId } }, { idempotencyKey: `workspace-customer/${workspaceId}` })
  const { error } = await admin.from('workspaces').update({ stripe_customer_id: customer.id }).eq('id', workspaceId).is('stripe_customer_id', null)
  if (error) throw error
  return (await read()).stripe_customer_id
}

export function validatePrice(price, item) {
  if (!price.active || price.type !== 'one_time' || price.currency !== 'usd' || price.unit_amount !== item.retail_price_cents) {
    throw conflict('The Stripe price does not match this package. Contact support before purchasing.')
  }
}

export async function createCheckout({ admin, stripe, workspaceId, userId, userEmail, packageId, requestKey, appUrl }) {
  const { data: existing, error: lookupError } = await admin.from('purchases').select('*').eq('workspace_id', workspaceId).eq('checkout_key', requestKey).maybeSingle()
  if (lookupError) throw lookupError
  let purchase = existing
  if (purchase && purchase.package_id !== packageId) throw conflict('This checkout attempt belongs to a different package.')
  if (!purchase) {
    const { data: item, error } = await admin.from('packages').select('*').eq('id', packageId).eq('active', true).single()
    if (error) throw error
    const priceId = config.stripeSecretKey.includes('_live_') ? item.stripe_live_price_id || item.stripe_price_id : item.stripe_test_price_id
    if (item.billing_type !== 'one_time' || !priceId) throw conflict('This package is not available for checkout yet.')
    validatePrice(await stripe.prices.retrieve(priceId), item)
    const customer = await ensureStripeCustomer(admin, stripe, workspaceId, userEmail)
    const result = await admin.rpc('reserve_checkout_attempt', { p_workspace_id: workspaceId, p_user_id: userId, p_package_id: packageId, p_key: requestKey, p_customer: customer, p_price: priceId, p_amount: item.retail_price_cents, p_app_url: appUrl })
    if (result.error) throw result.error
    purchase = result.data
  }
  if (purchase.status !== 'pending') throw conflict('This checkout attempt has already finished. Refresh billing before starting another purchase.')
  if (purchase.stripe_session_id) {
    const session = await stripe.checkout.sessions.retrieve(purchase.stripe_session_id)
    if (session.status !== 'open' || !session.url) throw conflict('This checkout is no longer open. Refresh billing to check its status.')
    return { id: purchase.id, checkoutUrl: session.url }
  }
  if (new Date(purchase.reservation_expires_at).getTime() - Date.now() < 30 * 60 * 1000) {
    throw conflict('This attempt needs reconciliation before it can be retried. Contact support.')
  }
  const metadata = { purchase_id: purchase.id, workspace_id: workspaceId, package_id: packageId }
  // Never release a reservation on an ambiguous network failure: Stripe may have created a payable session.
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', customer: purchase.checkout_customer_id,
    payment_method_types: ['card'],
    line_items: [{ price: purchase.checkout_price_id, quantity: 1 }],
    metadata, payment_intent_data: { metadata },
    expires_at: Math.floor(new Date(purchase.reservation_expires_at).getTime() / 1000),
    success_url: `${purchase.checkout_app_url}/?checkout=success&purchase=${purchase.id}#billing`,
    cancel_url: `${purchase.checkout_app_url}/?checkout=cancelled&purchase=${purchase.id}#billing`,
  }, { idempotencyKey: `checkout/${purchase.id}` })
  const { error } = await admin.from('purchases').update({ stripe_session_id: session.id }).eq('id', purchase.id)
  if (error) throw error
  return { id: purchase.id, checkoutUrl: session.url }
}
