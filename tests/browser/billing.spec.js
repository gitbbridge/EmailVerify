import { test, expect } from '@playwright/test'

async function setup(page, summary) {
  await page.addInitScript(() => localStorage.setItem('emailverify.session', JSON.stringify({ access_token: 'fixture' })))
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/billing/summary')) return summary(route, url)
    if (url.pathname.endsWith('/billing/portal-sessions')) return route.fulfill({ status: 503, json: { error: { message: 'Billing portal unavailable. Please retry.' } } })
    await route.fulfill({ json: url.pathname.endsWith('/me') ? { user: { first_name: 'Test' }, workspace: { role: 'owner' } } : url.pathname.endsWith('/credits') ? { available: 1000 } : url.pathname.endsWith('/batches') ? { items: [] } : {} })
  })
  await page.goto('/')
  const mobile = await page.getByLabel('Toggle navigation').isVisible()
  if (mobile) await page.getByLabel('Toggle navigation').click()
  await page.getByLabel('Profile menu').click()
  await page.getByRole('menuitem', { name: 'Billing', exact: true }).click()
}
const fixture = {
  available: 998, reserved: 2, lastAdded: { credits: 1000, date: '2026-09-01T00:00:00Z' }, portalAvailable: true,
  start: '2026-09-01T00:00:00Z', end: '2026-09-03T00:00:00Z',
    buckets: [{ bucket: '2026-09-01T00:00:00Z', bulk: 0, single: 0, api: 0, other: 0 }, { bucket: '2026-09-02T00:00:00Z', bulk: 1, single: 1, api: 0, other: 0 }],
  purchases: [{ id: 'purchase', credits: 5000, status: 'paid', created_at: '2026-09-01T00:00:00Z' }],
}
test('billing shows real response, filters, portal errors and responsive layout', async ({ page }, info) => {
  const periods = []
  await setup(page, (route, url) => { periods.push(url.searchParams.get('period')); return route.fulfill({ json: fixture }) })
  await expect(page.getByText('998', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /2 credits used/ })).toBeVisible()
  await page.getByLabel('Usage channel').selectOption('api')
  await expect(page.getByText('No credits used in this period.')).toBeVisible()
  await page.getByLabel('Usage channel').selectOption('all')
  await page.getByLabel('Usage period').selectOption('year')
  await expect.poll(() => periods.at(-1)).toBe('year')
  await page.getByRole('button', { name: 'Manage billing' }).click()
  await expect(page.getByRole('alert')).toHaveText('Billing portal unavailable. Please retry.')
  await expect(page.getByRole('button', { name: 'Manage billing' })).toBeEnabled()
  await expect(page.getByText('5,000', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath('billing.png'), fullPage: true })
})
test('billing empty and failed requests never display demo usage', async ({ page }) => {
  let fail = false
  await setup(page, (route) => route.fulfill(fail ? { status: 403, json: { error: { message: 'Only workspace owners and admins can access billing.' } } } : { json: { ...fixture, available: 1000, reserved: 0, portalAvailable: false, buckets: [], purchases: [] } }))
  await expect(page.getByText('No credits used in this period.')).toBeVisible()
  await expect(page.getByText('No purchases yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Manage billing' })).toBeDisabled()
  await expect(page.getByText('274K')).toHaveCount(0)
  await expect(page.getByText('ENABLE AUTO-REFILL')).toHaveCount(0)
  fail = true
  await page.getByLabel('Refresh billing').click()
  await expect(page.getByRole('alert')).toContainText('Only workspace owners')
  await expect(page.getByText('No credits used in this period.')).toHaveCount(0)
})
