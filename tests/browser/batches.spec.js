import { test, expect } from '@playwright/test'

const batchId = '00000000-0000-4000-8000-000000000111'

test('authenticated users can open, filter, search, and paginate real batch results', async ({ page }) => {
  const requests = []
  await page.addInitScript(() => localStorage.setItem('emailverify.session', JSON.stringify({ access_token: 'browser-fixture' })))
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path.includes(`/batches/${batchId}/results`)) {
      requests.push(url.toString())
      const pageNumber = Number(url.searchParams.get('page') || 1)
      const state = url.searchParams.get('state')
      const search = url.searchParams.get('search')
      const item = { id: `result-${pageNumber}`, row_number: pageNumber, email: search || 'risk@example.com', state: state === 'all' ? 'risky' : state, reason: 'low_deliverability', score: 42 }
      return route.fulfill({ json: { items: [item], page: pageNumber, pageSize: 25, total: 26, resultsAvailable: true } })
    }
    let body = {}
    if (path.endsWith('/auth/complete-signup')) body = { completed: true }
    if (path.endsWith('/me')) body = { user: { id: 'user-1', first_name: 'Taylor', last_name: 'List', email: 'owner@example.test' }, workspace: { id: 'workspace-1', role: 'owner', name: 'Northstar Studio' } }
    if (path.endsWith('/credits')) body = { available: 5000 }
    if (path.endsWith('/batches')) body = { items: [{ id: batchId, name: 'Leads September', status: 'complete', total: 748, processed: 748, total_counts: { deliverable: 500, risky: 180, undeliverable: 40, unknown: 28 }, reason_counts: { low_deliverability: 180 }, created_at: '2026-09-19T00:00:00.000Z', expires_at: '2027-03-25T00:00:00.000Z', results_available: true }] }
    return route.fulfill({ json: body })
  })
  await page.goto('/')
  await expect(page.getByText('Leads September')).toBeVisible()
  await page.getByRole('button', { name: 'VIEW RESULTS' }).click()
  await page.getByRole('button', { name: /^emails$/i }).last().click()
  await expect(page.getByText('risk@example.com')).toBeVisible()
  await page.getByRole('button', { name: /^risky$/i }).click()
  await page.getByLabel('Search email results').fill('filtered@example.com')
  await page.getByRole('button', { name: 'SEARCH' }).click()
  await expect(page.getByText('filtered@example.com')).toBeVisible()
  await page.getByRole('button', { name: 'NEXT', exact: true }).click()
  await expect(page.getByText('Page 2 of 2')).toBeVisible()
  expect(requests.some((url) => url.includes('state=risky') && url.includes('search=filtered%40example.com'))).toBe(true)
  expect(requests.some((url) => url.includes('page=2'))).toBe(true)
})
