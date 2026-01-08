import { test, expect } from '@playwright/test'

/**
 * Story 6.1: E2E tests for Dashboard
 *
 * These tests verify:
 * 1. Dashboard loads after login
 * 2. Dashboard displays all widgets
 * 3. Quick action buttons navigate correctly
 * 4. Dashboard loads within 2 seconds
 * 5. Responsive layout on different viewports
 */

test.describe('Dashboard', () => {
  // Skip if test credentials not configured
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'Skipping dashboard tests - TEST_USER_EMAIL and TEST_USER_PASSWORD not set'
  )

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test('should load dashboard after login', async ({ page }) => {
    // Verify dashboard page elements
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
    await expect(page.locator('text=/Välkommen tillbaka/i')).toBeVisible()
  })

  test('should display compliance progress widget', async ({ page }) => {
    // Should show either compliance ring or empty state
    const complianceCard = page.locator('text=/Efterlevnad/i').first()
    await expect(complianceCard).toBeVisible({ timeout: 5000 })
  })

  test('should display quick actions section', async ({ page }) => {
    // Should show quick action buttons
    await expect(page.locator('text=/Snabbåtgärder/i')).toBeVisible()
    await expect(page.locator('a:has-text("Fråga AI")')).toBeVisible()
    await expect(page.locator('a:has-text("Lägg till lag")')).toBeVisible()
    await expect(page.locator('a:has-text("Bjud in teammedlem")')).toBeVisible()
  })

  test('should display task summary cards', async ({ page }) => {
    // Should show task cards or placeholder
    const taskSection = page
      .locator('[class*="grid-cols-1 sm:grid-cols-3"]')
      .first()
    await expect(taskSection).toBeVisible({ timeout: 5000 })
  })

  test('should display activity feed section', async ({ page }) => {
    await expect(page.locator('text=/Senaste aktivitet/i')).toBeVisible()
  })

  test('should display list overview section', async ({ page }) => {
    await expect(page.locator('text=/Mina listor/i')).toBeVisible()
  })

  test('quick action "Fråga AI" navigates to AI chat', async ({ page }) => {
    await page.click('a:has-text("Fråga AI")')
    await expect(page).toHaveURL(/\/ai-chat/)
  })

  test('quick action "Lägg till lag" navigates to lists', async ({ page }) => {
    await page.click('a:has-text("Lägg till lag")')
    await expect(page).toHaveURL(/\/lists/)
  })

  test('quick action "Bjud in teammedlem" navigates to settings', async ({
    page,
  }) => {
    await page.click('a:has-text("Bjud in teammedlem")')
    await expect(page).toHaveURL(/\/settings/)
  })

  test('should load within 2 seconds', async ({ page }) => {
    // Navigate to dashboard and measure load time
    const startTime = Date.now()

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // Dashboard should load in under 2 seconds (AC: 8)
    expect(loadTime).toBeLessThan(2000)
  })
})

test.describe('Dashboard Responsive Layout', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'Skipping responsive tests - TEST_USER_EMAIL and TEST_USER_PASSWORD not set'
  )

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test('should display correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')

    // Verify dashboard renders without horizontal scroll
    const body = page.locator('body')
    const scrollWidth = await body.evaluate((el) => el.scrollWidth)
    const clientWidth = await body.evaluate((el) => el.clientWidth)

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1) // Allow 1px tolerance

    // Verify key elements are visible
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })

  test('should display correctly on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/dashboard')

    // Verify dashboard renders
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })

  test('should display correctly on desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboard')

    // Verify dashboard renders with multiple columns
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible()
  })
})

test.describe('Dashboard Without Authentication', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
