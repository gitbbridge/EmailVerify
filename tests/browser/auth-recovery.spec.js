import { test, expect } from '@playwright/test'

test('valid recovery callback updates the password and clears the recovery session', async ({ page }) => {
  let request
  await page.route('**/api/v1/auth/password-update', async (route) => {
    request = { authorization: route.request().headers().authorization, body: route.request().postDataJSON() }
    await route.fulfill({ json: { updated: true } })
  })
  await page.goto('/#access_token=recovery-access-token&refresh_token=recovery-refresh-token-123456&expires_in=3600&type=recovery')
  await expect(page.getByRole('heading', { name: 'Choose a new password.' })).toBeVisible()
  await page.getByLabel('New password', { exact: true }).fill('StrongPassword2026')
  await page.getByLabel('Confirm new password').fill('DifferentPassword2026')
  await page.getByRole('button', { name: 'UPDATE PASSWORD' }).click()
  await expect(page.getByRole('alert')).toContainText('do not match')
  expect(request).toBeUndefined()
  await page.getByLabel('Confirm new password').fill('StrongPassword2026')
  await page.getByRole('button', { name: 'UPDATE PASSWORD' }).click()
  await expect(page.getByRole('heading', { name: 'Password updated.' })).toBeVisible()
  expect(request.authorization).toBe('Bearer recovery-access-token')
  expect(request.body).toEqual({ password: 'StrongPassword2026', refreshToken: 'recovery-refresh-token-123456' })
  expect(await page.evaluate(() => localStorage.getItem('emailverify.session'))).toBeNull()
})

test('expired recovery callback offers a fresh link without showing a password field', async ({ page }) => {
  await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
  await expect(page.getByRole('alert')).toContainText('invalid or has expired')
  await expect(page.getByLabel('New password')).toHaveCount(0)
  await page.getByRole('button', { name: 'REQUEST A NEW LINK' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await expect(page.getByLabel('Work email')).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
})

test('forgot-password request uses only an email field and keeps the response generic', async ({ page }) => {
  await page.route('**/api/v1/auth/password-reset', (route) => route.fulfill({ status: 202, json: { accepted: true } }))
  await page.goto('/')
  await page.getByRole('button', { name: 'VIEW THE APP' }).click()
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  await page.getByLabel('Work email').fill('person@example.test')
  await page.getByRole('button', { name: 'SEND RESET LINK' }).click()
  await expect(page.getByText('Password reset instructions are on the way.')).toBeVisible()
})
