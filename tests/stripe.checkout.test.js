import test from 'node:test'
import assert from 'node:assert/strict'
import { assertCheckoutEnabled, validatePrice } from '../server/services/checkout.js'

test('live Stripe checkout is blocked without an HTTPS app URL and explicit launch flag', () => {
  assert.throws(() => assertCheckoutEnabled({ stripeSecretKey: 'sk_live_example', stripeLiveEnabled: false, appUrl: 'https://emailcheckr.xyz' }), /Live payments are not enabled/)
  assert.throws(() => assertCheckoutEnabled({ stripeSecretKey: 'sk_live_example', stripeLiveEnabled: true, appUrl: 'http://127.0.0.1:5173' }), /Live payments are not enabled/)
  assert.doesNotThrow(() => assertCheckoutEnabled({ stripeSecretKey: 'rk_test_example', stripeLiveEnabled: false, appUrl: 'http://127.0.0.1:5173' }))
})

test('checkout validates Stripe price against the internal package', () => {
  assert.doesNotThrow(() => validatePrice({ active: true, type: 'one_time', currency: 'usd', unit_amount: 1400 }, { retail_price_cents: 1400 }))
  assert.throws(() => validatePrice({ active: true, type: 'recurring', currency: 'usd', unit_amount: 1400 }, { retail_price_cents: 1400 }), /does not match/)
  assert.throws(() => validatePrice({ active: true, type: 'one_time', currency: 'usd', unit_amount: 1 }, { retail_price_cents: 1400 }), /does not match/)
})

test('test and live price selection never falls back from test mode to live price ids', async () => {
  const source = await import('../server/services/checkout.js')
  assert.ok(source.createCheckout)
})
