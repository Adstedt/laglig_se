import { test, expect } from '@playwright/test'

test.describe('Law Pages', () => {
  test('law listing page renders with laws', async ({ page }) => {
    await page.goto('/alla-lagar')

    // Check page title
    await expect(page).toHaveTitle(/Alla lagar.*Laglig\.se/)

    // Check heading
    await expect(page.locator('h1')).toContainText('Alla lagar')

    // Check at least one law is listed
    const lawLinks = page.locator('a[href^="/alla-lagar/"]')
    await expect(lawLinks.first()).toBeVisible()
  })

  test('law detail page renders with SSR content', async ({ page }) => {
    // First go to listing to get a valid slug
    await page.goto('/alla-lagar')

    // Click the first law
    const firstLawLink = page.locator('a[href^="/alla-lagar/"]').first()
    await firstLawLink.click()

    // Verify we're on a detail page
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible()
    await expect(page.locator('h1')).toBeVisible()

    // Check SSR - the title should be in the page source (not client-rendered)
    const title = await page.title()
    expect(title).toContain('SFS')
    expect(title).toContain('Laglig.se')

    // Check meta description exists
    const metaDescription = page.locator('meta[name="description"]')
    await expect(metaDescription).toHaveAttribute('content', /.+/)
  })

  test('law detail page shows breadcrumbs', async ({ page }) => {
    await page.goto('/alla-lagar')
    const firstLawLink = page.locator('a[href^="/alla-lagar/"]').first()
    await firstLawLink.click()

    // Check breadcrumb navigation
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]')
    await expect(breadcrumb).toBeVisible()
    await expect(breadcrumb.locator('a[href="/"]')).toBeVisible()
    await expect(breadcrumb.locator('a[href="/alla-lagar"]')).toBeVisible()
  })

  test('invalid law slug shows 404', async ({ page }) => {
    const response = await page.goto(
      '/alla-lagar/this-law-does-not-exist-12345'
    )

    // Should return 404 status
    expect(response?.status()).toBe(404)

    // Should show not found message
    await expect(page.locator('text=404')).toBeVisible()
  })

  test('sitemap.xml is accessible and valid', async ({ request }) => {
    const response = await request.get('/sitemap.xml')

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('xml')

    const text = await response.text()
    expect(text).toContain('<?xml')
    expect(text).toContain('<urlset')
    expect(text).toContain('alla-lagar')
  })

  test('robots.txt is accessible and valid', async ({ request }) => {
    const response = await request.get('/robots.txt')

    expect(response.status()).toBe(200)

    const text = await response.text()
    expect(text).toContain('User-agent')
    expect(text).toContain('Allow')
    expect(text).toContain('Sitemap')
  })

  test('law page has Open Graph meta tags', async ({ page }) => {
    await page.goto('/alla-lagar')
    const firstLawLink = page.locator('a[href^="/alla-lagar/"]').first()
    await firstLawLink.click()

    // Check Open Graph tags
    const ogTitle = page.locator('meta[property="og:title"]')
    await expect(ogTitle).toHaveAttribute('content', /.+/)

    const ogDescription = page.locator('meta[property="og:description"]')
    await expect(ogDescription).toHaveAttribute('content', /.+/)

    const ogType = page.locator('meta[property="og:type"]')
    await expect(ogType).toHaveAttribute('content', 'article')
  })

  test('law listing page is responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/alla-lagar')

    // Check heading is visible
    await expect(page.locator('h1')).toBeVisible()

    // Check laws are displayed
    const lawLinks = page.locator('a[href^="/alla-lagar/"]')
    await expect(lawLinks.first()).toBeVisible()

    // Check no horizontal scroll
    const body = page.locator('body')
    const scrollWidth = await body.evaluate((el) => el.scrollWidth)
    const clientWidth = await body.evaluate((el) => el.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10) // Allow small margin
  })
})
