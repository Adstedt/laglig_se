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

  // Use keyboard to find "36 §" - the actual section header, not definition reference
  // Look for the h3 element with "36 §"
  const section36Header = page.locator('h3:has-text("36 §")').first()

  if (await section36Header.count() > 0) {
    await section36Header.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test-results/screenshots/section-36-header.png', fullPage: false })
    console.log('Screenshot of section 36 header saved')
  } else {
    console.log('No h3 with 36 § found, scrolling to find it...')
    // Scroll down significantly
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollBy(0, 800))
      await page.waitForTimeout(200)
    }
    await page.screenshot({ path: 'test-results/screenshots/section-36-scroll.png', fullPage: false })
    console.log('Scroll screenshot saved')
  }

  console.log('Browser will close in 5 seconds...')
  await page.waitForTimeout(5000)

  await browser.close()
}

captureScreenshot().catch(console.error)
