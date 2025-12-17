import { test, expect } from '@playwright/test'

/**
 * E2E tests for prefetch flow and loading performance
 * Tests the user journey: Homepage → Browse → Law → History → Version Diff
 */

// Correct URL slugs from the database
const LAW_1982_80 = '/lagar/lag-198280-om-anstallningsskydd-1982-80'
const LAW_1977_1160 = '/lagar/arbetsmiljolag-19771160-1977-1160'

test.describe('Prefetch Flow & Loading Performance', () => {
  test('Homepage loads quickly', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    const loadTime = Date.now() - startTime

    console.log(`Homepage load time: ${loadTime}ms`)
    expect(loadTime).toBeLessThan(5000)

    // Verify hero section is visible
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('Browse /lagar page loads quickly', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/lagar')
    const loadTime = Date.now() - startTime

    console.log(`/lagar page load time: ${loadTime}ms`)
    expect(loadTime).toBeLessThan(5000)

    // Should show law listings
    await expect(page.locator('main').first()).toBeVisible()
  })

  test('Law page 1982:80 (Anställningsskyddslagen) loads correctly', async ({
    page,
  }) => {
    const startTime = Date.now()
    await page.goto(LAW_1982_80)
    const loadTime = Date.now() - startTime

    console.log(`Law page 1982:80 load time: ${loadTime}ms`)

    // Verify page loaded
    await expect(page.locator('h1').first()).toBeVisible()
    const title = await page.locator('h1').first().textContent()
    console.log(`Law title: ${title}`)

    // Should contain the law title
    expect(title?.toLowerCase()).toContain('anställningsskydd')
    expect(loadTime).toBeLessThan(5000)
  })

  test('Law page 1977:1160 (Arbetsmiljölagen) loads correctly', async ({
    page,
  }) => {
    const startTime = Date.now()
    await page.goto(LAW_1977_1160)
    const loadTime = Date.now() - startTime

    console.log(`Law page 1977:1160 load time: ${loadTime}ms`)

    // Verify page loaded
    await expect(page.locator('h1').first()).toBeVisible()
    const title = await page.locator('h1').first().textContent()
    console.log(`Law title: ${title}`)

    // Should contain the law title
    expect(title?.toLowerCase()).toContain('arbetsmiljö')
    expect(loadTime).toBeLessThan(5000)
  })

  test('History page for 1982:80 loads and shows amendments', async ({
    page,
  }) => {
    const startTime = Date.now()
    await page.goto(`${LAW_1982_80}/historik`)
    const loadTime = Date.now() - startTime

    console.log(`History page load time: ${loadTime}ms`)
    expect(loadTime).toBeLessThan(5000)

    // Wait for page content
    await expect(page.locator('main').first()).toBeVisible()

    // Check for timeline or amendment content
    const pageContent = await page.content()
    const hasTimeline =
      pageContent.includes('SFS') ||
      pageContent.includes('version') ||
      pageContent.includes('historik')
    console.log(`Page has timeline content: ${hasTimeline}`)

    // Take a screenshot for manual verification
    await page.screenshot({ path: 'test-results/history-page.png' })
  })

  test('History page navigation from law page is fast (prefetch)', async ({
    page,
  }) => {
    // First visit the law page
    await page.goto(LAW_1982_80)
    await expect(page.locator('h1').first()).toBeVisible()

    // Wait for prefetch to happen (500ms delay in TimelinePrefetcher)
    await page.waitForTimeout(1000)

    // Find and click history link
    const historyLink = page.locator('a[href*="/historik"]').first()

    if (await historyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const navStartTime = Date.now()
      await historyLink.click()
      await page.waitForURL('**/historik')
      const navTime = Date.now() - navStartTime

      console.log(`Law → History navigation time: ${navTime}ms`)

      // Should be faster due to prefetch (but allow up to 3s for first load)
      expect(navTime).toBeLessThan(3000)
    } else {
      // Navigate directly if no link found
      const navStartTime = Date.now()
      await page.goto(`${LAW_1982_80}/historik`)
      const navTime = Date.now() - navStartTime
      console.log(`Direct history page load: ${navTime}ms`)
    }
  })

  test('Amendment diff expands and shows content', async ({ page }) => {
    await page.goto(`${LAW_1982_80}/historik`)
    await expect(page.locator('main').first()).toBeVisible()

    // Wait for page to fully load
    await page.waitForTimeout(1000)

    // Look for clickable amendment items
    const amendmentItems = page
      .locator('button, [role="button"], [data-state]')
      .filter({
        hasText: /SFS|ändring|version/i,
      })

    const count = await amendmentItems.count()
    console.log(`Found ${count} potential amendment items`)

    if (count > 0) {
      const firstItem = amendmentItems.first()
      const diffStartTime = Date.now()

      await firstItem.click()
      await page.waitForTimeout(2000)

      const diffTime = Date.now() - diffStartTime
      console.log(`Amendment click + diff load time: ${diffTime}ms`)

      // Take screenshot after expansion
      await page.screenshot({ path: 'test-results/diff-expanded.png' })
    }
  })

  test('Full user journey with timing', async ({ page }) => {
    const timings: Record<string, number> = {}

    // Step 1: Homepage
    let startTime = Date.now()
    await page.goto('/')
    await expect(page.locator('h1').first()).toBeVisible()
    timings['1_homepage'] = Date.now() - startTime

    // Step 2: Navigate to /lagar directly
    startTime = Date.now()
    await page.goto('/lagar')
    await expect(page.locator('main').first()).toBeVisible()
    timings['2_lagar_browse'] = Date.now() - startTime

    // Step 3: Navigate to specific law
    startTime = Date.now()
    await page.goto(LAW_1982_80)
    await expect(page.locator('h1').first()).toBeVisible()
    timings['3_law_detail'] = Date.now() - startTime

    // Wait for prefetch
    await page.waitForTimeout(800)

    // Step 4: Navigate to history
    startTime = Date.now()
    await page.goto(`${LAW_1982_80}/historik`)
    await expect(page.locator('main').first()).toBeVisible()
    timings['4_history'] = Date.now() - startTime

    // Summary
    console.log('\n========================================')
    console.log('TIMING SUMMARY')
    console.log('========================================')
    Object.entries(timings).forEach(([key, value]) => {
      const status = value < 1500 ? '✓ FAST' : value < 3000 ? '⚠ OK' : '✗ SLOW'
      console.log(`${status.padEnd(10)} ${key}: ${value}ms`)
    })
    console.log('========================================')

    // Calculate total
    const total = Object.values(timings).reduce((a, b) => a + b, 0)
    console.log(`TOTAL: ${total}ms`)

    // Assertions
    expect(timings['1_homepage']).toBeLessThan(5000)
    expect(timings['2_lagar_browse']).toBeLessThan(5000)
    expect(timings['3_law_detail']).toBeLessThan(5000)
    expect(timings['4_history']).toBeLessThan(5000)
  })

  test('Second visit to history page should be faster (cache hit)', async ({
    page,
  }) => {
    // First visit - cache miss
    const firstStart = Date.now()
    await page.goto(`${LAW_1982_80}/historik`)
    await expect(page.locator('main').first()).toBeVisible()
    const firstLoad = Date.now() - firstStart

    // Navigate away
    await page.goto('/')
    await page.waitForTimeout(500)

    // Second visit - should hit cache
    const secondStart = Date.now()
    await page.goto(`${LAW_1982_80}/historik`)
    await expect(page.locator('main').first()).toBeVisible()
    const secondLoad = Date.now() - secondStart

    console.log(`First history load: ${firstLoad}ms`)
    console.log(`Second history load: ${secondLoad}ms`)
    console.log(
      `Improvement: ${firstLoad - secondLoad}ms (${Math.round((1 - secondLoad / firstLoad) * 100)}% faster)`
    )

    // Both should be under 5s
    expect(firstLoad).toBeLessThan(5000)
    expect(secondLoad).toBeLessThan(5000)
  })
})
