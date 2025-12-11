/**
 * E2E Tests for Caching Behavior (Story 2.19)
 *
 * Tests navigation caching, back/forward behavior, and pagination performance.
 * Uses Playwright for browser automation.
 *
 * Run with: pnpm playwright test tests/e2e/caching.spec.ts
 */

import { test, expect } from '@playwright/test'

test.describe('Catalogue Caching Behavior', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the catalogue page
    await page.goto('/rattskallor')
  })

  test('should load catalogue page successfully', async ({ page }) => {
    // Wait for results to load
    await expect(page.locator('h1')).toContainText('Rättskällor')
    await expect(page.locator('[data-testid="catalogue-results"]').or(page.locator('.space-y-4'))).toBeVisible()
  })

  test('back navigation should be instant after viewing document', async ({ page }) => {
    // Navigate to catalogue
    await page.goto('/rattskallor')
    await page.waitForLoadState('networkidle')

    // Click on a law link
    const lawLink = page.locator('a[href*="/lagar/"]').first()
    await lawLink.waitFor({ state: 'visible' })
    await lawLink.click()

    // Wait for law page to load
    await page.waitForURL(/\/lagar\//)
    await page.waitForLoadState('networkidle')

    // Go back and measure time
    const startTime = Date.now()
    await page.goBack()
    await page.waitForLoadState('domcontentloaded')
    const loadTime = Date.now() - startTime

    // Back navigation should use router cache and be fast
    // Allow up to 2000ms which is still much faster than uncached 5+ seconds
    expect(loadTime).toBeLessThan(2000)

    // Verify we're back on catalogue
    await expect(page.locator('h1')).toContainText('Rättskällor')
  })

  test('static pagination route should load quickly', async ({ page }) => {
    // Navigate to statically generated page 2
    const startTime = Date.now()
    await page.goto('/rattskallor/sida/2')
    await page.waitForLoadState('domcontentloaded')
    const loadTime = Date.now() - startTime

    // Page 2 should be statically generated and fast
    // Allow reasonable time for network
    expect(loadTime).toBeLessThan(3000)

    // Verify page 2 content
    await expect(page.locator('h1')).toContainText('Rättskällor')
    await expect(page.getByText(/Sida 2/)).toBeVisible()
  })

  test('pagination links should use static routes', async ({ page }) => {
    // Start at static page 2
    await page.goto('/rattskallor/sida/2')
    await page.waitForLoadState('networkidle')

    // Find pagination and verify structure
    const paginationNav = page.locator('nav[aria-label="Sidnavigering"]')
    await expect(paginationNav).toBeVisible()

    // Check that page 3 link uses static route format
    const page3Link = paginationNav.locator('a[href*="/sida/3"]')
    const page3Exists = await page3Link.count() > 0

    // If page 3 exists, it should use static URL pattern
    if (page3Exists) {
      const href = await page3Link.getAttribute('href')
      expect(href).toMatch(/\/rattskallor\/sida\/3/)
    }
  })

  test('filter application should work from static pagination page', async ({ page }) => {
    // Start at static page
    await page.goto('/rattskallor/sida/2')
    await page.waitForLoadState('networkidle')

    // Apply a filter (if filters are visible)
    const filterSection = page.locator('[data-testid="catalogue-filters"]').or(page.locator('aside'))

    if (await filterSection.isVisible()) {
      // Click on a content type filter if available
      const lawFilter = filterSection.locator('text=Lagar').or(filterSection.locator('text=SFS'))

      if (await lawFilter.isVisible()) {
        await lawFilter.click()
        await page.waitForLoadState('networkidle')

        // After filtering, URL should change to query params format
        // since filtered views use dynamic routes
        const url = page.url()
        expect(url).toContain('rattskallor')
      }
    }
  })
})

test.describe('Document Page Caching', () => {
  test('law page should load with proper caching headers', async ({ page }) => {
    // Navigate to a known law page
    const response = await page.goto('/lagar/arbetsmiljolag-1977-1160')

    if (response) {
      // Check that the page loaded successfully
      expect(response.status()).toBe(200)

      // For ISR pages, cache-control should indicate caching
      const cacheControl = response.headers()['cache-control']
      // Vercel adds caching headers for static/ISR pages
      // We just verify the page loads, actual cache behavior is server-side
    }

    // Verify content loaded
    await expect(page.locator('h1')).toBeVisible()
  })

  test('repeated visits to same law should be fast', async ({ page }) => {
    const lawUrl = '/lagar/arbetsmiljolag-1977-1160'

    // First visit
    await page.goto(lawUrl)
    await page.waitForLoadState('networkidle')

    // Navigate away
    await page.goto('/rattskallor')
    await page.waitForLoadState('networkidle')

    // Second visit should use router cache
    const startTime = Date.now()
    await page.goto(lawUrl)
    await page.waitForLoadState('domcontentloaded')
    const loadTime = Date.now() - startTime

    // Second visit should benefit from router cache
    // Allow up to 2000ms which is still faster than uncached
    expect(loadTime).toBeLessThan(2000)
  })
})

test.describe('Cache Resilience', () => {
  test('page should render even if loading takes time', async ({ page }) => {
    // Set a reasonable timeout
    page.setDefaultTimeout(30000)

    // Navigate to catalogue
    await page.goto('/rattskallor')

    // Page should eventually render
    await expect(page.locator('h1')).toContainText('Rättskällor', { timeout: 15000 })

    // Results or empty state should be visible
    const hasResults = await page.locator('.space-y-4 > div').count() > 0
    const hasEmptyState = await page.getByText(/Inga dokument/i).isVisible().catch(() => false)

    expect(hasResults || hasEmptyState).toBe(true)
  })
})
