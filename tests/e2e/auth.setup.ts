import { test as setup, expect } from '@playwright/test'
import { join } from 'path'

const authFile = join(__dirname, '../.auth/user.json')

/**
 * Authentication setup for Playwright tests
 *
 * This runs before tests that require authentication.
 * It logs in via the UI and stores the session for reuse.
 *
 * To use:
 * 1. Set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars
 * 2. Run: pnpm playwright test --project=chromium
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    console.log('⚠️ TEST_USER_EMAIL and TEST_USER_PASSWORD not set')
    console.log('   Skipping auth setup - workspace tests will be skipped')
    return
  }

  // Go to login page
  await page.goto('/login')

  // Fill in credentials
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)

  // Submit
  await page.click('button[type="submit"]')

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 10000 })

  // Verify we're logged in
  await expect(page.locator('h1')).toContainText('Dashboard')

  // Store authentication state
  await page.context().storageState({ path: authFile })

  console.log('✓ Authentication successful, state saved')
})
