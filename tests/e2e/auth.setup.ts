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

  await page.fill('input#email', email)
  await page.fill('input#password', password)
  await page.click('button[type="submit"]')

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  })
  await expect(page).not.toHaveURL(/\/login/)

  mkdirSync(dirname(authFile), { recursive: true })
  await page.context().storageState({ path: authFile })
})
