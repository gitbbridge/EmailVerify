import { test, expect } from '@playwright/test'

test('upload sends multipart file and displays approval or validation feedback', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('emailverify.session', JSON.stringify({ access_token: 'fixture' })))
  let uploads = 0
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/batches/upload')) {
      expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=')
      expect(route.request().headers().authorization).toBe('Bearer fixture')
      expect(route.request().headers()['idempotency-key']).toMatch(/^[a-f0-9-]{36}$/)
      uploads++
      return route.fulfill(uploads === 1 ? { status: 202, json: { id: 'upload', name: 'Imported leads', total: 2, status: 'approval_pending', approval_required: true } } : { status: 400, json: { error: { message: 'No valid email cells were found.' } } })
    }
    const body = path.endsWith('/batches') ? { items: [] } : path.endsWith('/credits') ? { available: 1000 } : path.endsWith('/me') ? { user: { first_name: 'Test' }, workspace: { id: 'workspace-a', role: 'owner' } } : {}
    await route.fulfill({ json: body })
  })
  await page.goto('/')
  await page.getByLabel('Upload email list').setInputFiles({ name: 'leads.csv', mimeType: 'text/csv', buffer: Buffer.from('Email\na@example.com\nb@example.com') })
  await expect(page.getByText('Imported leads')).toBeVisible()
  await expect(page.getByText(/No credits have been reserved yet/)).toBeVisible()
  await page.getByLabel('Upload email list').setInputFiles({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.from('Empty') })
  await expect(page.getByText('No valid email cells were found.')).toBeVisible()
  await expect(page.getByLabel('Upload email list')).toBeEnabled()
})

test('retry after reload reuses its key and success permits a fresh import', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('emailverify.session', JSON.stringify({ access_token: 'fixture' })))
  const keys = []
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/batches/upload')) {
      keys.push(route.request().headers()['idempotency-key'])
      if (keys.length === 1) return route.fulfill({ status: 503, json: { error: { message: 'Connection interrupted. Try again.' } } })
      return route.fulfill({ status: 202, json: { id: 'retried', name: 'Recovered import', total: 1, status: 'approval_pending', approval_required: true, replayed: true } })
    }
    await route.fulfill({ json: path.endsWith('/batches') ? { items: [] } : path.endsWith('/credits') ? { available: 1000 } : path.endsWith('/me') ? { user: { first_name: 'Test' }, workspace: { id: 'workspace-a', role: 'owner' } } : {} })
  })
  await page.goto('/')
  const file = { name: 'retry.txt', mimeType: 'text/plain', buffer: Buffer.from('a@example.com') }
  await page.getByLabel('Upload email list').setInputFiles(file)
  await expect(page.getByText('Connection interrupted. Try again.')).toBeVisible()
  await page.reload()
  await page.getByLabel('Upload email list').setInputFiles(file)
  await expect(page.getByText('Recovered import')).toBeVisible()
  expect(keys).toHaveLength(2)
  expect(keys[0]).toBe(keys[1])
  await page.getByLabel('Upload email list').setInputFiles(file)
  await expect.poll(() => keys.length).toBe(3)
  expect(keys[2]).not.toBe(keys[1])
})
