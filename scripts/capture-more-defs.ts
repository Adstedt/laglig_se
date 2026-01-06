import { chromium } from 'playwright'

async function captureScreenshot() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.setViewportSize({ width: 1280, height: 900 })

  const url = 'http://localhost:3000/lagar/andringar/lag-om-andring-i-lagen-om-tillaggsskatt-2025-1461'
  console.log(`Navigating to: ${url}`)

  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Scroll down further to see more definitions
  await page.evaluate(() => window.scrollBy(0, 1200))
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screenshots/amendment-defs-more.png', fullPage: false })
  console.log('Screenshot 1 saved')

  // Scroll even more
  await page.evaluate(() => window.scrollBy(0, 800))
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screenshots/amendment-defs-more2.png', fullPage: false })
  console.log('Screenshot 2 saved')

  console.log('Browser will close in 3 seconds...')
  await page.waitForTimeout(3000)

  await browser.close()
}

captureScreenshot().catch(console.error)
