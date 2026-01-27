import { chromium } from 'playwright'

async function captureScreenshot() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.setViewportSize({ width: 1280, height: 900 })

  const url =
    'http://localhost:3000/lagar/andringar/lag-om-andring-i-lagen-om-tillaggsskatt-2025-1461'
  console.log(`Navigating to: ${url}`)

  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Search for § 36 on page and scroll to it
  const section36 = page.locator('text=36 §').first()
  if (await section36.isVisible({ timeout: 5000 })) {
    await section36.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'test-results/screenshots/section-36.png',
      fullPage: false,
    })
    console.log('Screenshot of section 36 saved')
  } else {
    console.log('Section 36 not found, taking scroll screenshots')
    // Scroll down to find it
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 600))
      await page.waitForTimeout(300)
      const content = await page.textContent('body')
      if (content?.includes('36 §')) {
        await page.screenshot({
          path: 'test-results/screenshots/section-36.png',
          fullPage: false,
        })
        console.log(`Found section 36 at scroll ${i}`)
        break
      }
    }
  }

  console.log('Browser will close in 5 seconds...')
  await page.waitForTimeout(5000)

  await browser.close()
}

captureScreenshot().catch(console.error)
