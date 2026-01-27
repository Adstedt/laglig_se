import { chromium } from 'playwright'

async function testProductionPerformance() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  console.log('=== Production Performance Test ===\n')
  console.log('Testing: https://laglig-se.vercel.app\n')

  const results: { page: string; time: number }[] = []

  try {
    // Login
    console.log('1. Logging in...')
    await page.goto('https://laglig-se.vercel.app/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'alexander.adstedt+10@kontorab.se')
    await page.fill('input[type="password"]', 'KBty8611!!!!')

    const loginStart = Date.now()
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 30000 })
    await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 15000 })
    await page.waitForLoadState('networkidle')
    const loginTime = Date.now() - loginStart
    results.push({ page: 'Login → Dashboard', time: loginTime })
    console.log(`   Login → Dashboard: ${loginTime}ms`)

    await page.waitForTimeout(1000)

    // Test Settings
    console.log('\n2. Testing Settings (Inställningar)...')
    const settingsStart = Date.now()
    await page.click('a[href="/settings"]')
    await page.waitForURL('**/settings**')
    await page.waitForLoadState('networkidle')
    const settingsTime = Date.now() - settingsStart
    results.push({ page: 'Settings', time: settingsTime })
    console.log(`   Settings: ${settingsTime}ms`)

    await page.waitForTimeout(500)

    // Test Dashboard (return)
    console.log('\n3. Testing Dashboard (return)...')
    const dashReturnStart = Date.now()
    await page.click('a[href="/dashboard"]').catch(() => {
      // Try clicking the first dashboard link if multiple exist
      return page.locator('a[href="/dashboard"]').first().click()
    })
    await page.waitForURL('**/dashboard**')
    await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    const dashReturnTime = Date.now() - dashReturnStart
    results.push({ page: 'Dashboard (return)', time: dashReturnTime })
    console.log(`   Dashboard (return): ${dashReturnTime}ms`)

    await page.waitForTimeout(500)

    // Test Laglistor
    console.log('\n4. Testing Laglistor...')
    // Open accordion
    const laglistorBtn = page.locator('button:has-text("Laglistor")')
    if ((await laglistorBtn.count()) > 0) {
      await laglistorBtn.click()
      await page.waitForTimeout(300)
    }

    const laglistorStart = Date.now()
    await page.click('a[href="/laglistor"]')
    await page.waitForURL('**/laglistor**')
    await page.waitForLoadState('networkidle')
    const laglistorTime = Date.now() - laglistorStart
    results.push({ page: 'Laglistor', time: laglistorTime })
    console.log(`   Laglistor: ${laglistorTime}ms`)

    await page.waitForTimeout(500)

    // Test Settings again (should be faster if cached)
    console.log('\n5. Testing Settings (2nd visit)...')
    const settings2Start = Date.now()
    await page.click('a[href="/settings"]')
    await page.waitForURL('**/settings**')
    await page.waitForLoadState('networkidle')
    const settings2Time = Date.now() - settings2Start
    results.push({ page: 'Settings (2nd)', time: settings2Time })
    console.log(`   Settings (2nd): ${settings2Time}ms`)

    await page.waitForTimeout(500)

    // Test Dashboard again
    console.log('\n6. Testing Dashboard (2nd visit)...')
    const dash2Start = Date.now()
    await page.locator('a[href="/dashboard"]').first().click()
    await page.waitForURL('**/dashboard**')
    await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    const dash2Time = Date.now() - dash2Start
    results.push({ page: 'Dashboard (2nd)', time: dash2Time })
    console.log(`   Dashboard (2nd): ${dash2Time}ms`)

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('RESULTS SUMMARY')
    console.log('='.repeat(50))
    console.log('\nPage                    | Time     | Target  | Status')
    console.log('-'.repeat(50))

    const targets: Record<string, number> = {
      'Login → Dashboard': 3000,
      Settings: 500,
      'Dashboard (return)': 500,
      Laglistor: 1000,
      'Settings (2nd)': 300,
      'Dashboard (2nd)': 300,
    }

    for (const r of results) {
      const target = targets[r.page] || 1000
      const status = r.time <= target ? '✅' : '⚠️'
      console.log(
        `${r.page.padEnd(24)}| ${String(r.time).padStart(6)}ms | ${String(target).padStart(5)}ms | ${status}`
      )
    }

    const avgTime = Math.round(
      results.reduce((sum, r) => sum + r.time, 0) / results.length
    )
    console.log('-'.repeat(50))
    console.log(`Average: ${avgTime}ms`)

    // Keep browser open
    console.log('\n📊 Browser open for 30s for manual inspection...')
    await page.waitForTimeout(30000)
  } catch (error) {
    console.error('Error:', error)
    await page.waitForTimeout(10000)
  } finally {
    await browser.close()
  }
}

testProductionPerformance()
