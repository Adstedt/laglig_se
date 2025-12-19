import { chromium } from '@playwright/test'

async function reviewDashboard() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  })
  const page = await context.newPage()

  // Go to login page
  await page.goto('http://localhost:3000/login')
  await page.waitForLoadState('networkidle')

  // Fill login form
  await page.fill('input[type="email"]', 'alexander.adstedt+10@kontorab.se')
  await page.fill('input[type="password"]', 'KBty8611!!!!')
  await page.click('button[type="submit"]')

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  // Take screenshot
  await page.screenshot({
    path: 'screenshots/dashboard-review.png',
    fullPage: true,
  })
  console.log('Screenshot saved to screenshots/dashboard-review.png')

  // Get page HTML structure for review
  const headerHTML = await page.evaluate(() => {
    const header = document.querySelector('header')
    return header?.outerHTML || 'No header found'
  })
  console.log('\n=== HEADER HTML ===\n', headerHTML)

  await browser.close()
}

reviewDashboard().catch(console.error)
