import 'dotenv/config'
import Stripe from 'stripe'
import pg from 'pg'
if (!process.env.DATABASE_URL || !process.env.STRIPE_TEST_SECRET_KEY) throw new Error('DATABASE_URL and STRIPE_TEST_SECRET_KEY are required.')
const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY)
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
try {
  const { rows } = await db.query('select id,name,credits,retail_price_cents,billing_type,billing_interval,stripe_test_price_id from public.packages where active order by sort_order')
  const products = await stripe.products.list({ limit: 100, active: true })
  let created = 0
  for (const item of rows) {
    if (item.stripe_test_price_id) continue
    const product = products.data.find((candidate) => candidate.metadata?.package_id === item.id)
      || await stripe.products.create({ name: `EmailVerify ${item.name}`, metadata: { package_id: item.id, environment: 'test' } }, { idempotencyKey: `emailverify-test-product/${item.id}` })
    const price = await stripe.prices.create({
      product: product.id, currency: 'usd', unit_amount: item.retail_price_cents,
      ...(item.billing_type === 'subscription' ? { recurring: { interval: item.billing_interval || 'month' } } : {}),
      metadata: { package_id: item.id, environment: 'test' },
    }, { idempotencyKey: `emailverify-test-price/${item.id}` })
    await db.query('update public.packages set stripe_test_price_id=$1,updated_at=now() where id=$2', [price.id, item.id])
    created++
  }
  console.log(`Stripe test prices ready. Created ${created}; existing ${rows.length - created}.`)
} finally { await db.end() }
