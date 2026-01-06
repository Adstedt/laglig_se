import { chromium } from 'playwright'

async function captureScreenshot() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Navigate to the specific amendment page
  const url = 'http://localhost:3000/lagar/andringar/lag-om-andring-i-lagen-om-tillaggsskatt-2025-1461'
  console.log(`Navigating to: ${url}`)

  await page.goto(url, { waitUntil: 'networkidle' })

  // Wait for content to load
  await page.waitForTimeout(3000)

  // Take screenshot
  const screenshotPath = 'test-results/screenshots/amendment-2025-1461.png'
  await page.screenshot({ path: screenshotPath, fullPage: true })
  console.log(`Screenshot saved to: ${screenshotPath}`)

  // Keep browser open for inspection
  console.log('Browser will stay open for 10 seconds for inspection...')
  await page.waitForTimeout(10000)

  await browser.close()
}

captureScreenshot().catch(console.error)
