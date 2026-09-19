import { test, expect } from '@playwright/test'

const owner = '00000000-0000-4000-8000-000000000001'
const member = '00000000-0000-4000-8000-000000000002'
const token = 'a'.repeat(64)

async function setup(page, role = 'owner') {
  await page.addInitScript(() => localStorage.setItem('emailverify.session', JSON.stringify({ access_token: 'browser-fixture' })))
  const writes = []
  let removed = false
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (method !== 'GET') writes.push({ path, method, body: route.request().postDataJSON() })
    if (method === 'DELETE' && path.endsWith(member)) removed = true
    let body = {}
    if (path.endsWith('/me')) body = { user: { id: owner, first_name: 'Taylor', last_name: 'Team', email: 'owner@example.test' }, workspace: { id: 'workspace', role, name: 'Northstar Studio' } }
    if (path.endsWith('/credits')) body = { available: 5000 }
    if (path.endsWith('/batches')) body = { items: [] }
    if (path.endsWith('/team') && method === 'GET') body = { members: [
      { user_id: owner, role, created_at: '2026-09-01', profile: { first_name: 'Taylor', last_name: 'Team', email: 'owner@example.test' } },
      { user_id: member, role: 'member', created_at: '2026-09-10', profile: { first_name: 'Jordan', last_name: 'Lee', email: 'jordan@example.test' } },
    ].filter((entry) => !removed || entry.user_id !== member), invitations: [], events: [] }
    await route.fulfill({ json: body })
  })
  return writes
}

async function openTeam(page) {
  await page.goto('/')
  if (await page.getByRole('button', { name: 'Toggle navigation' }).isVisible()) await page.getByRole('button', { name: 'Toggle navigation' }).click()
  await page.getByRole('button', { name: 'Profile menu', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Account & team' })).toBeVisible()
  await expect(page.getByText('Jordan Lee')).toBeVisible()
}

test('owner can invite and confirm a member removal', async ({ page }, testInfo) => {
  const writes = await setup(page)
  await openTeam(page)
  await page.getByLabel('Email address', { exact: true }).fill('new@example.test')
  await page.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByRole('status')).toContainText('Invitation sent')
  expect(writes.find((request) => request.path.endsWith('/team/invitations')).body).toEqual({ email: 'new@example.test', role: 'member' })
  await page.getByRole('button', { name: 'Remove jordan@example.test' }).click()
  expect(writes.some((request) => request.method === 'DELETE')).toBe(false)
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Member removed')
  expect(writes.some((request) => request.method === 'DELETE' && request.path.endsWith(member))).toBe(true)
  await expect(page.getByText('Jordan Lee')).toHaveCount(0)
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('.overflow-x-auto').forEach((element) => { element.scrollLeft = 0 }) })
  await page.screenshot({ path: testInfo.outputPath('team.png'), fullPage: true })
  const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter((element) => element.getBoundingClientRect().right > innerWidth && getComputedStyle(element).visibility !== 'hidden').map((element) => ({ tag: element.tagName, class: element.className })).slice(0, 8) }))
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width)
})

test('members see no invitation or role management controls', async ({ page }) => {
  await setup(page, 'member')
  await openTeam(page)
  await expect(page.getByRole('button', { name: 'Send invitation' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Remove jordan@example.test' })).toHaveCount(0)
  await expect(page.getByRole('combobox')).toHaveCount(0)
})

test('invitation requires explicit acceptance and preserves token through sign-in', async ({ page }) => {
  const writes = await setup(page)
  await page.goto(`/?invitation=${token}`)
  await expect(page.getByRole('heading', { name: 'Join your team' })).toBeVisible()
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(page.getByRole('heading', { name: 'Account & team' })).toBeVisible()
  expect(writes[0].body.invitationToken).toBe(token)
  await expect(page).not.toHaveURL(/invitation=/)
})

test('invited signup omits workspace input and includes invite token', async ({ page }) => {
  let signup
  await page.route('**/api/v1/auth/signup', async (route) => {
    signup = route.request().postDataJSON()
    await route.fulfill({ json: { requiresEmailConfirmation: true } })
  })
  await page.goto(`/?invitation=${token}`)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByLabel('Company name')).toHaveCount(0)
  await page.getByLabel('First name').fill('Jordan')
  await page.getByLabel('Last name').fill('Lee')
  await page.getByLabel('Work email').fill('jordan@example.test')
  await page.getByLabel('Password', { exact: true }).fill('local-test-password')
  await page.getByRole('button', { name: 'CREATE ACCOUNT', exact: true }).click()
  await expect(page.getByText('Check your inbox to confirm your email, then sign in.')).toBeVisible()
  expect(signup.invitationToken).toBe(token)
  expect(signup.workspaceName).toBe('Invited team')
})
