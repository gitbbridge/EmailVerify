import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createApp } from '../server/app.js'
import { assertProductionConfigured } from '../server/config.js'
import { getSignupFingerprint } from '../server/services/signupFingerprint.js'

async function withServer(app, check) {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try { await check(`http://127.0.0.1:${server.address().port}`) }
  finally { await new Promise((resolve) => server.close(resolve)) }
}

test('deployment serves the frontend, hashed assets, JSON API and no private files', async () => {
  await withServer(createApp({ serveFrontend: true }), async (base) => {
    const home = await fetch(base)
    assert.equal(home.status, 200)
    assert.equal(home.headers.get('cache-control'), 'no-store')
    assert.match(home.headers.get('content-security-policy'), /default-src 'self'/)
    assert.equal(home.headers.get('x-powered-by'), null)
    const html = await home.text()
    const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/)[1]
    const js = await fetch(`${base}${asset}`)
    assert.equal(js.status, 200)
    assert.match(js.headers.get('cache-control'), /immutable/)
    const route = await fetch(`${base}/account/billing`)
    assert.equal(await route.text(), html)
    assert.equal((await fetch(`${base}/api/health`)).status, 200)
    const missingApi = await fetch(`${base}/api/missing`)
    assert.equal(missingApi.status, 404)
    assert.equal((await missingApi.json()).error.code, 'not_found')
    for (const route of ['/.env', '/.git/config', '/assets/missing.js', '/missing.png']) {
      assert.equal((await fetch(`${base}${route}`)).status, 404, route)
    }
    assert.equal((await fetch(`${base}/api/v1/billing/summary`)).status, 401)
  })
})

test('signup identity ignores forged forwarding headers unless a proxy is trusted', async () => {
  const app = express()
  app.get('/', (request, response) => response.json(getSignupFingerprint(request)))
  await withServer(app, async (base) => {
    const first = await (await fetch(base)).json()
    const forged = await (await fetch(base, { headers: { 'x-forwarded-for': '203.0.113.15', 'cf-connecting-ip': '198.51.100.12' } })).json()
    assert.deepEqual(forged, first)
  })
  app.set('trust proxy', 1)
  await withServer(app, async (base) => {
    const first = await (await fetch(base, { headers: { 'x-forwarded-for': '203.0.113.15' } })).json()
    const second = await (await fetch(base, { headers: { 'x-forwarded-for': '198.51.100.12' } })).json()
    assert.notEqual(first.ipHash, second.ipHash)
  })
})

test('production rejects missing secrets, insecure origins and conflicting Stripe modes', () => {
  const env = { NODE_ENV: 'production', SUPABASE_URL: 'set', SUPABASE_ANON_KEY: 'set', SUPABASE_SERVICE_ROLE_KEY: 'set', RESEND_API_KEY: 'set', EMAIL_FROM: 'set', ADMIN_EMAIL: 'set', SIGNUP_FINGERPRINT_SECRET: 'a'.repeat(32), EMAILABLE_API_KEY: 'set' }
  const settings = { appUrl: 'https://emailverify.onrender.com', clientOrigin: 'https://emailverify.onrender.com', trustProxyHops: 1, stripeLiveEnabled: false }
  assert.doesNotThrow(() => assertProductionConfigured(settings, env))
  assert.throws(() => assertProductionConfigured(settings, { NODE_ENV: 'production' }), /Missing production configuration/)
  assert.throws(() => assertProductionConfigured({ ...settings, appUrl: 'http://localhost:8788' }, env), /HTTPS/)
  assert.throws(() => assertProductionConfigured({ ...settings, trustProxyHops: NaN }, env), /TRUST_PROXY_HOPS/)
  assert.throws(() => assertProductionConfigured({ ...settings, stripeLiveEnabled: true, stripeTestSecretKey: 'sk_test_example' }, env), /test overrides/)
})
