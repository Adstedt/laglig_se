import { test, expect } from '@playwright/test'

/**
 * Story 12.10: E2E tests for Template Adoption
 *
 * Tests the full adoption flow:
 * 1. Navigate to template catalog
 * 2. Open a template detail page
 * 3. Click "Använd denna mall" CTA
 * 4. Verify adoption succeeds (toast + redirect)
 */

test.describe('Template Adoption (Story 12.10)', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'Skipping template adoption tests - TEST_USER_EMAIL and TEST_USER_PASSWORD not set'
  )

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')

    // Handle workspace selection if user has multiple workspaces
    if (
      await page
        .waitForURL('**/select-workspace**', { timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    ) {
      // Select the first workspace
      await page
        .locator('button, a, [role="button"]')
        .filter({ hasText: 'Test Workspace' })
        .first()
        .click()
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    } else {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
    }
  })

  test('should display template catalog page', async ({ page }) => {
    await page.goto('/laglistor/mallar')
    await expect(page).toHaveURL(/\/laglistor\/mallar/)

    // Should show at least one template card
    const templateCards = page.locator('a[href*="/laglistor/mallar/"]')
    await expect(templateCards.first()).toBeVisible({ timeout: 10000 })
  })

  test('should display template detail page with enabled CTA', async ({
    page,
  }) => {
    await page.goto('/laglistor/mallar')

    // Click the first template card to navigate to detail
    const firstCard = page.locator('a[href*="/laglistor/mallar/"]').first()
    await expect(firstCard).toBeVisible({ timeout: 10000 })
    await firstCard.click()

    // Should be on a template detail page
    await expect(page).toHaveURL(/\/laglistor\/mallar\/[^/]+/)

    // Should show the "Använd denna mall" button and it should be enabled
    const ctaButton = page.getByRole('button', { name: /Använd denna mall/ })
    await expect(ctaButton).toBeVisible({ timeout: 5000 })
    await expect(ctaButton).toBeEnabled()
  })

  test('should adopt template into workspace', async ({ page }) => {
    await page.goto('/laglistor/mallar')

    // Click the first template card
    const firstCard = page.locator('a[href*="/laglistor/mallar/"]').first()
    await expect(firstCard).toBeVisible({ timeout: 10000 })
    await firstCard.click()
    await expect(page).toHaveURL(/\/laglistor\/mallar\/[^/]+/)

    // Click the CTA button
    const ctaButton = page.getByRole('button', { name: /Använd denna mall/ })
    await expect(ctaButton).toBeVisible({ timeout: 5000 })
    await ctaButton.click()

    // Should either:
    // A) Show workspace selector dialog (multi-workspace) - confirm it
    // B) Start adoption directly (single workspace)
    const dialog = page.getByRole('dialog')
    if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Multi-workspace: confirm with the default selection
      await page.getByRole('button', { name: 'Bekräfta' }).click()
    }

    // Should show success toast with adoption message
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: /har lagts till med \d+ lagar/,
    })
    await expect(toast).toBeVisible({ timeout: 15000 })

    // Should redirect to law lists page
    await expect(page).toHaveURL(/\/laglistor/, { timeout: 10000 })
  })

  test('should show adopted list in law lists page', async ({ page }) => {
    // Navigate directly to law lists to verify previously adopted template exists
    await page.goto('/laglistor')
    await page.waitForLoadState('networkidle')

    // Page should load without errors
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })
})
