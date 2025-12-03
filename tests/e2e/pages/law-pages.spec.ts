import { test, expect } from '@playwright/test'

test.describe('SFS Law Pages', () => {
  test('should render law listing page', async ({ page }) => {
    await page.goto('/lagar')

    // Check page title
    await expect(page).toHaveTitle(/Svenska lagar/)

    // Check breadcrumbs
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()

    // Check heading
    await expect(page.getByRole('heading', { name: 'Svenska lagar', level: 1 })).toBeVisible()

    // Check that laws are listed
    await expect(page.locator('article, [class*="card"]').first()).toBeVisible()
  })

  test('should render individual law page with SSR content', async ({ page }) => {
    // First go to listing to find a law
    await page.goto('/lagar', { waitUntil: 'networkidle' })

    // Wait for the page to be fully loaded
    await page.waitForLoadState('domcontentloaded')

    // Click on first law link - must wait for hydration
    const firstLawLink = page.locator('a[href^="/lagar/"]').first()
    await expect(firstLawLink).toBeVisible({ timeout: 10000 })

    // Get the href and navigate directly (more reliable than click)
    const href = await firstLawLink.getAttribute('href')
    if (href) {
      await page.goto(href)
    }

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded')

    // Verify we're on a law detail page
    expect(page.url()).toMatch(/\/lagar\/[^/]+$/)

    // Check breadcrumbs
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()

    // Check page has main heading
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Check that the SFS number is shown somewhere on the page
    await expect(page.getByText(/SFS \d{4}:\d+/).first()).toBeVisible()
  })

  test('should have proper meta tags on law page', async ({ page }) => {
    await page.goto('/lagar')
    const firstLawLink = page.locator('a[href^="/lagar/"]').first()
    const href = await firstLawLink.getAttribute('href')
    if (href) {
      await page.goto(href)
    }
    await page.waitForLoadState('domcontentloaded')

    // Check meta description exists (use head to avoid duplicate in body)
    const metaDescription = page.locator('head meta[name="description"]')
    await expect(metaDescription).toHaveAttribute('content', /.+/)

    // Check Open Graph tags (use head)
    await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content', /.+/)
    await expect(page.locator('head meta[property="og:type"]')).toHaveAttribute('content', 'article')

    // Check canonical URL (use head)
    const canonical = page.locator('head link[rel="canonical"]')
    await expect(canonical).toHaveAttribute('href', /laglig\.se\/lagar\//)
  })

  test('should have JSON-LD structured data', async ({ page }) => {
    await page.goto('/lagar')
    const firstLawLink = page.locator('a[href^="/lagar/"]').first()
    const href = await firstLawLink.getAttribute('href')
    if (href) {
      await page.goto(href)
    }
    await page.waitForLoadState('domcontentloaded')

    // Check JSON-LD script exists (scripts are not visible but can be found)
    const jsonLdScript = page.locator('script[type="application/ld+json"]')
    await expect(jsonLdScript).toHaveCount(1)

    // Verify JSON-LD content
    const jsonLdContent = await jsonLdScript.textContent()
    expect(jsonLdContent).toBeTruthy()

    const jsonLd = JSON.parse(jsonLdContent!)
    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('Legislation')
    expect(jsonLd.name).toBeTruthy()
    expect(jsonLd.inLanguage).toBe('sv')
  })

  test('should show 404 for non-existent law', async ({ page }) => {
    await page.goto('/lagar/non-existent-law-12345')

    // Should show 404 content
    await expect(page.getByText('404')).toBeVisible()
    await expect(page.getByRole('heading', { name: /kunde inte hittas/i })).toBeVisible()
  })
})

test.describe('Court Case Pages', () => {
  test('should render court cases index page', async ({ page }) => {
    await page.goto('/rattsfall')

    await expect(page).toHaveTitle(/Svenska rättsfall/)
    await expect(page.getByRole('heading', { name: 'Svenska rättsfall', level: 1 })).toBeVisible()

    // Should show court options
    await expect(page.getByText('Högsta domstolen')).toBeVisible()
  })

  test('should render court-specific listing page', async ({ page }) => {
    await page.goto('/rattsfall/hd')

    await expect(page).toHaveTitle(/Högsta domstolen/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Högsta domstolen')
  })

  test('should render individual court case page', async ({ page }) => {
    await page.goto('/rattsfall/hd')

    // Click on first case
    const firstCaseLink = page.locator('a[href^="/rattsfall/hd/"]').first()

    // Skip if no cases exist
    if (await firstCaseLink.count() === 0) {
      test.skip()
      return
    }

    await firstCaseLink.click()

    // Verify breadcrumbs and heading
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('EU Legislation Pages', () => {
  test('should render EU legislation index page', async ({ page }) => {
    await page.goto('/eu')

    await expect(page).toHaveTitle(/EU-lagstiftning/)
    await expect(page.getByRole('heading', { name: 'EU-lagstiftning', level: 1 })).toBeVisible()

    // Should show EU type options
    await expect(page.getByText('EU-förordningar')).toBeVisible()
    await expect(page.getByText('EU-direktiv')).toBeVisible()
  })

  test('should render EU type listing page', async ({ page }) => {
    await page.goto('/eu/forordningar')

    await expect(page).toHaveTitle(/EU-förordningar/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('EU-förordningar')
  })

  test('should render individual EU document page', async ({ page }) => {
    await page.goto('/eu/forordningar')

    const firstDocLink = page.locator('a[href^="/eu/forordningar/"]').first()

    // Skip if no documents exist
    if (await firstDocLink.count() === 0) {
      test.skip()
      return
    }

    await firstDocLink.click()

    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Check for CELEX number
    await expect(page.getByText(/CELEX:/)).toBeVisible()
  })
})

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('should be responsive on mobile', async ({ page }) => {
    await page.goto('/lagar')

    // Page should not have horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1) // +1 for rounding

    // Content should be readable
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
  })

  test('should have readable text on law detail page', async ({ page }) => {
    await page.goto('/lagar')
    const firstLawLink = page.locator('a[href^="/lagar/"]').first()
    const href = await firstLawLink.getAttribute('href')
    if (href) {
      await page.goto(href)
    }
    await page.waitForLoadState('domcontentloaded')

    // Main content should be visible (use getByRole to avoid strict mode violation)
    await expect(page.getByRole('main')).toBeVisible()

    // Text should not overflow
    const main = page.getByRole('main')
    const mainWidth = await main.evaluate((el) => el.scrollWidth)
    const mainClientWidth = await main.evaluate((el) => el.clientWidth)
    expect(mainWidth).toBeLessThanOrEqual(mainClientWidth + 10)
  })
})

test.describe('Sitemap and Robots', () => {
  test('should serve sitemap.xml', async ({ page }) => {
    const response = await page.goto('/sitemap.xml')
    expect(response?.status()).toBe(200)

    // Browser renders XML, check for content in rendered page
    const content = await page.content()
    expect(content).toContain('urlset')
    expect(content).toContain('url')
    expect(content).toContain('/lagar/')
  })

  test('should serve robots.txt', async ({ page }) => {
    const response = await page.goto('/robots.txt')
    expect(response?.status()).toBe(200)

    // Browser wraps plain text in HTML, check for content
    const content = await page.content()
    expect(content).toContain('User-Agent')
    expect(content).toContain('Allow: /')
    expect(content).toContain('Disallow: /api/')
    expect(content).toContain('Sitemap:')
  })
})

test.describe('Legal Disclaimer', () => {
  test('should show legal disclaimer in footer on homepage', async ({ page }) => {
    // Footer is on homepage, not law listing page
    await page.goto('/')

    // Scroll to footer
    await page.locator('footer').scrollIntoViewIfNeeded()

    // Check disclaimer text
    await expect(page.getByText(/Juridisk ansvarsfriskrivning/)).toBeVisible()
    await expect(page.getByText(/AI-assisterad juridisk information/)).toBeVisible()
    await expect(page.getByText(/inte juridisk rådgivning/)).toBeVisible()
  })
})
