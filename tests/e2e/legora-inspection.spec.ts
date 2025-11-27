import { test } from '@playwright/test'

test('capture legora screenshots', async ({ page }) => {
  await page.goto('https://legora.com/', {
    waitUntil: 'networkidle',
    timeout: 30000,
  })

  await page.screenshot({
    path: 'test-results/legora/01-hero.png',
    fullPage: false,
  })

  await page.evaluate(() => window.scrollBy(0, 900))
  await page.waitForTimeout(500)
  await page.screenshot({
    path: 'test-results/legora/02-section.png',
    fullPage: false,
  })

  await page.evaluate(() => window.scrollBy(0, 900))
  await page.waitForTimeout(500)
  await page.screenshot({
    path: 'test-results/legora/03-section.png',
    fullPage: false,
  })

  await page.evaluate(() => window.scrollBy(0, 900))
  await page.waitForTimeout(500)
  await page.screenshot({
    path: 'test-results/legora/04-section.png',
    fullPage: false,
  })

  await page.evaluate(() => window.scrollBy(0, 900))
  await page.waitForTimeout(500)
  await page.screenshot({
    path: 'test-results/legora/05-section.png',
    fullPage: false,
  })

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  await page.screenshot({
    path: 'test-results/legora/00-full.png',
    fullPage: true,
  })
})
