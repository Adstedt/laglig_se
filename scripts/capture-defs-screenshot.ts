import { chromium } from 'playwright'

async function captureScreenshot() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.setViewportSize({ width: 1280, height: 900 })

  // Navigate to the specific amendment page
  const url =
    'http://localhost:3000/lagar/andringar/lag-om-andring-i-lagen-om-tillaggsskatt-2025-1461'
  console.log(`Navigating to: ${url}`)

  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Take viewport screenshot (not full page)
  const screenshotPath = 'test-results/screenshots/amendment-defs-viewport.png'
  await page.screenshot({ path: screenshotPath, fullPage: false })
  console.log(`Screenshot saved to: ${screenshotPath}`)

  // Scroll down to see more definitions
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(500)
  await page.screenshot({
    path: 'test-results/screenshots/amendment-defs-scrolled.png',
    fullPage: false,
  })
  console.log('Scrolled screenshot saved')

  // Keep browser open for inspection
  console.log('Browser will close in 5 seconds...')
  await page.waitForTimeout(5000)

  await browser.close()
}

captureScreenshot().catch(console.error)
