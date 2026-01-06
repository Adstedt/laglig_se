import { chromium } from 'playwright'

async function findOverflow() {
  const browser = await chromium.launch({ headless: true })

  // Test multiple viewport sizes
  const viewports = [
    { width: 1920, height: 1080, name: '1080p' },
    { width: 1536, height: 864, name: '1536x864 (common laptop)' },
    { width: 1440, height: 900, name: '1440x900' },
    { width: 1366, height: 768, name: '1366x768 (common)' },
    { width: 1280, height: 720, name: '720p' },
  ]

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await context.newPage()

    // Login
    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || '')
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || '')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|laglistor)/, { timeout: 15000 })

    // Go to laglistor
    await page.goto('http://localhost:3000/laglistor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // Close AI chat if open
    const closeButton = page.locator('button[aria-label="Stäng AI Chat"]')
    if (await closeButton.isVisible()) {
      await closeButton.click()
      await page.waitForTimeout(500)
    }

    // Check overflow
    const result = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth
      const bodyScrollWidth = document.body.scrollWidth
      const htmlScrollWidth = document.documentElement.scrollWidth
      return {
        viewportWidth,
        bodyScrollWidth,
        htmlScrollWidth,
        hasOverflow: bodyScrollWidth > viewportWidth || htmlScrollWidth > viewportWidth,
        overflowAmount: Math.max(bodyScrollWidth, htmlScrollWidth) - viewportWidth,
      }
    })

    console.log(`\n${vp.name} (${vp.width}x${vp.height}):`)
    console.log(`  Viewport: ${result.viewportWidth}, Body: ${result.bodyScrollWidth}, HTML: ${result.htmlScrollWidth}`)
    console.log(`  Overflow: ${result.hasOverflow ? `YES (${result.overflowAmount}px)` : 'No'}`)

    await context.close()
  }

  await browser.close()
}

findOverflow().catch(console.error)
