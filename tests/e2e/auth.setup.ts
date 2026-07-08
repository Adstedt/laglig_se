import { test as setup, expect } from '@playwright/test'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'

const authFile = join(__dirname, '../.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.local for authenticated specs.'
    )
  }

  await page.goto('/login')

  // The cookie-consent banner overlays the form on a fresh profile —
  // dismiss it before interacting with the login form.
  const consent = page.getByRole('button', { name: 'Bara nödvändiga' })
  if (await consent.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await consent.click()
  }

  await page.fill('input#email', email)
  await page.fill('input#password', password)
  // Submit via Enter: the submit button carries an animated shadow
  // transition, so Playwright's click stability check never settles.
  await page.press('input#password', 'Enter')

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  })
  await expect(page).not.toHaveURL(/\/login/)

  // Multi-workspace accounts land on the picker — select the first
  // workspace so authed specs start inside an active workspace context.
  const picker = page.getByRole('heading', { name: 'Välj arbetsplats' })
  if (await picker.isVisible({ timeout: 3_000 }).catch(() => false)) {
    // Workspace entries render as buttons suffixed with the member role.
    await page
      .getByRole('button')
      .filter({ hasText: /Ägare|Medlem|Admin/ })
      .first()
      .click()
    await page.waitForURL((url) => url.pathname !== '/', { timeout: 15_000 })
  }

  // The active-workspace context lives in the active_workspace_id cookie,
  // set server-side by the selection action — wait for it before capturing
  // storage state, or every authed spec bounces back to the picker.
  await expect
    .poll(
      async () => {
        const cookies = await page.context().cookies()
        return cookies.some((c) => c.name === 'active_workspace_id')
      },
      { timeout: 10_000, message: 'active_workspace_id cookie never set' }
    )
    .toBe(true)

  mkdirSync(dirname(authFile), { recursive: true })
  await page.context().storageState({ path: authFile })
})
