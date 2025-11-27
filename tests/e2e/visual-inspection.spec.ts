import { test } from '@playwright/test'

test.describe('Visual Inspection Screenshots', () => {
  test('capture full page sections', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Full page screenshot
    await page.screenshot({
      path: 'test-results/screenshots/full-page.png',
      fullPage: true,
    })

    // Hero section
    await page.screenshot({
      path: 'test-results/screenshots/01-hero.png',
    })

    // Scroll to features section
    await page
      .getByRole('heading', { name: /allt du behöver för fullständig/i })
      .scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'test-results/screenshots/02-features.png',
    })

    // Scroll to how it works
    await page.locator('#how-it-works').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'test-results/screenshots/03-how-it-works.png',
    })

    // Scroll to testimonials
    await page
      .getByRole('heading', { name: /företag som sover gott/i })
      .scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'test-results/screenshots/04-testimonials.png',
    })

    // Scroll to compliance section
    await page
      .getByRole('heading', { name: /audit-redo/i })
      .scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'test-results/screenshots/05-compliance.png',
    })

    // Scroll to pricing
    await page.locator('#pricing').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'test-results/screenshots/06-pricing.png',
    })

    // Scroll to FAQ
    await page.locator('#faq').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'test-results/screenshots/07-faq.png',
    })

    // Footer
    await page.locator('footer').scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'test-results/screenshots/08-footer.png',
    })

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: 'test-results/screenshots/09-mobile-hero.png',
    })

    await page.screenshot({
      path: 'test-results/screenshots/10-mobile-full.png',
      fullPage: true,
    })
  })
})
