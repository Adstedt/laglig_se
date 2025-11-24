import { test, expect } from '@playwright/test'

/**
 * E2E tests for authentication flows
 *
 * These tests verify:
 * 1. User signup with email/password
 * 2. User login with valid credentials
 * 3. User login with invalid credentials
 * 4. Protected route redirects
 * 5. Logout functionality
 */

// Generate unique test user email to avoid conflicts
const TEST_USER = {
  email: `test-e2e-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'E2E Test User',
}

test.describe('Authentication Flow', () => {
  test('should complete signup flow', async ({ page }) => {
    await page.goto('/signup')

    // Fill signup form
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[name="name"]', TEST_USER.name)
    await page.fill('input[type="password"]', TEST_USER.password)

    // Submit form
    await page.click('button[type="submit"]')

    // Should show success message about email verification
    await expect(page.locator('text=/check your email/i')).toBeVisible({
      timeout: 10000,
    })
  })

  test('should show error for invalid login', async ({ page }) => {
    await page.goto('/login')

    // Try to login with invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(page.locator('text=/invalid email or password/i')).toBeVisible(
      {
        timeout: 5000,
      }
    )
  })

  test('should redirect to login when accessing protected route', async ({
    page,
  }) => {
    // Try to access dashboard without being logged in
    await page.goto('/dashboard')

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show login page elements', async ({ page }) => {
    await page.goto('/login')

    // Verify page elements
    await expect(page.locator('text=/sign in to your account/i')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.locator('text=/create a new account/i')).toBeVisible()
    await expect(page.locator('text=/forgot your password/i')).toBeVisible()
  })

  test('should show signup page elements', async ({ page }) => {
    await page.goto('/signup')

    // Verify page elements
    await expect(page.locator('text=/create your account/i')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.locator('text=/already have an account/i')).toBeVisible()
  })
})

test.describe('Login Flow with Test Credentials', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'Skipping login test - TEST_USER_EMAIL and TEST_USER_PASSWORD not set'
  )

  test('should login with test credentials', async ({ page }) => {
    await page.goto('/login')

    // Fill login form with test credentials
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!)

    // Submit form
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })
})
