import { test } from '@playwright/test'

test.describe('Mobile Visual Inspection', () => {
  test('capture mobile views', async ({ page }) => {
    // iPhone 12 Pro viewport
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Hero section
    await page.screenshot({
      path: 'test-results/mobile/01-hero.png',
      fullPage: false,
    })

    // Scroll down sections and capture
    await page.evaluate(() => window.scrollBy(0, 800))
    await page.waitForTimeout(300)
    await page.screenshot({
      path: 'test-results/mobile/02-stats.png',
      fullPage: false,
    })

    await page.evaluate(() => window.scrollBy(0, 800))
    await page.waitForTimeout(300)
    await page.screenshot({
      path: 'test-results/mobile/03-features.png',
      fullPage: false,
    })

    await page.evaluate(() => window.scrollBy(0, 800))
    await page.waitForTimeout(300)
    await page.screenshot({
      path: 'test-results/mobile/04-how-it-works.png',
      fullPage: false,
    })

    await page.evaluate(() => window.scrollBy(0, 800))
    await page.waitForTimeout(300)
    await page.screenshot({
      path: 'test-results/mobile/05-testimonials.png',
      fullPage: false,
    })

    await page.evaluate(() => window.scrollBy(0, 800))
    await page.waitForTimeout(300)
    await page.screenshot({
      path: 'test-results/mobile/06-compliance.png',
      fullPage: false,
    })

    await page.locator('#pricing').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await page.screenshot({
      path: 'test-results/mobile/07-pricing.png',
      fullPage: false,
    })

    await page.evaluate(() => window.scrollBy(0, 800))
    await page.waitForTimeout(300)
    await page.screenshot({
      path: 'test-results/mobile/08-faq.png',
      fullPage: false,
    })

    // Full page screenshot
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'test-results/mobile/00-full-page.png',
      fullPage: true,
    })
  })

  test('capture tablet views', async ({ page }) => {
    // iPad viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Full page screenshot
    await page.screenshot({
      path: 'test-results/tablet/00-full-page.png',
      fullPage: true,
    })
  })
})
