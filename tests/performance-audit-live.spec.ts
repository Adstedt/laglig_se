import { test, expect, Page } from '@playwright/test'

// Test configuration - using LIVE deployed URL
const BASE_URL = 'https://laglig-se.vercel.app'
const TEST_ACCOUNT = {
  email: 'alexander.adstedt+10@kontorab.se',
  password: 'KBty8611!!!!',
}

// Disable local server and set proper browser context
test.use({
  baseURL: BASE_URL,
  // Accept cookies and handle authentication
  contextOptions: {
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
  },
})

// Performance measurement helper
class PerformanceTracker {
  private metrics: Map<string, any> = new Map()

  async measureNavigation(
    page: Page,
    name: string,
    action: () => Promise<void>
  ) {
    const startTime = Date.now()

    // Start measuring
    await page.evaluate(() => performance.mark('nav-start'))

    // Execute action
    await action()

    // Wait for network idle and content
    await page.waitForLoadState('networkidle', { timeout: 30000 })

    const endTime = Date.now()
    const duration = endTime - startTime

    // Get additional metrics
    const performanceMetrics = await page.evaluate(() => {
      performance.mark('nav-end')
      performance.measure('navigation', 'nav-start', 'nav-end')
      const measure = performance.getEntriesByName('navigation')[0]

      return {
        duration: measure?.duration || 0,
        domContentLoaded:
          performance.timing.domContentLoadedEventEnd -
          performance.timing.navigationStart,
        loadComplete:
          performance.timing.loadEventEnd - performance.timing.navigationStart,
      }
    })

    const metrics = {
      name,
      totalDuration: duration,
      ...performanceMetrics,
      timestamp: new Date().toISOString(),
    }

    this.metrics.set(name, metrics)
    console.log(`📊 ${name}: ${duration}ms`)

    return metrics
  }

  getReport() {
    return Array.from(this.metrics.values())
  }
}

test.describe('Laglig.se Performance Audit - LIVE', () => {
  let tracker: PerformanceTracker

  test.beforeEach(async ({ page }) => {
    tracker = new PerformanceTracker()

    // Set viewport
    await page.setViewportSize({ width: 1920, height: 1080 })

    // Set longer timeout for live site
    test.setTimeout(120000)
  })

  test('Complete Performance Audit - Live Site', async ({ page }) => {
    console.log('🚀 Starting Laglig.se Performance Audit - LIVE ENVIRONMENT')
    console.log('URL:', BASE_URL)
    console.log('================================')

    // 1. LOGIN AND INITIAL LOAD
    console.log('\n📍 1. Login Performance')

    // Try navigating with a simpler approach - don't wait for network idle initially
    console.log('  Navigating to login page...')

    try {
      await page.goto(`${BASE_URL}/login`, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      })
    } catch (error) {
      console.log('  Redirect issue detected, trying alternative approach...')
      // If redirect loop, try clearing cookies and going directly
      await page.context().clearCookies()
      await page.goto(`${BASE_URL}/login`, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      })
    }

    // Wait for login form to be visible
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })

    // Measure login performance
    await tracker.measureNavigation(page, '1.1 Login Process', async () => {
      await page.fill('input[type="email"]', TEST_ACCOUNT.email)
      await page.fill('input[type="password"]', TEST_ACCOUNT.password)
      await page.click('button[type="submit"]')

      // Wait for navigation away from login page
      await page.waitForFunction(
        () => !window.location.pathname.includes('/login'),
        { timeout: 30000 }
      )
    })

    console.log('  Login successful, now at:', page.url())

    await page.screenshot({
      path: 'screenshots/01-dashboard-initial.png',
      fullPage: true,
    })

    // 2. WORKSPACE SELECTOR PERFORMANCE
    console.log('\n📍 2. Workspace Selector Performance')

    // Look for workspace switcher
    const workspaceSwitcher = page
      .locator(
        '[data-testid="workspace-switcher"], button:has-text("Workspace"), button:has-text("Arbetsplats")'
      )
      .first()

    if (await workspaceSwitcher.isVisible()) {
      const workspaceSwitcherStart = Date.now()
      await workspaceSwitcher.click()
      await page.waitForSelector(
        '[role="menuitem"], [data-radix-collection-item]',
        { timeout: 5000 }
      )
      const workspaceSwitcherOpen = Date.now() - workspaceSwitcherStart
      console.log(`  Dropdown open time: ${workspaceSwitcherOpen}ms`)

      await page.screenshot({ path: 'screenshots/02-workspace-dropdown.png' })

      // Get available workspaces
      const workspaces = await page
        .locator('[role="menuitem"], [data-radix-collection-item]')
        .all()
      console.log(`  Found ${workspaces.length} workspaces`)

      // Try to switch to Grro Technologies
      const grroWorkspace = page
        .locator(
          '[role="menuitem"]:has-text("Grro Technologies"), [data-radix-collection-item]:has-text("Grro Technologies")'
        )
        .first()
      if (await grroWorkspace.isVisible().catch(() => false)) {
        await tracker.measureNavigation(
          page,
          '2.1 Switch to Grro Technologies',
          async () => {
            await grroWorkspace.click()
            await page.waitForTimeout(2000) // Wait for workspace switch
          }
        )
        await page.screenshot({ path: 'screenshots/02-grro-workspace.png' })
      } else {
        // Click outside to close dropdown
        await page.keyboard.press('Escape')
      }
    }

    // 3. LAW LISTS (LAGLISTOR) NAVIGATION
    console.log('\n📍 3. Law Lists Navigation & Performance')

    // Find and expand Efterlevnad in sidebar
    const laglistorButton = page
      .locator('button:has-text("Efterlevnad"), div:has-text("Efterlevnad")')
      .first()

    if (await laglistorButton.isVisible()) {
      await tracker.measureNavigation(
        page,
        '3.1 Expand Efterlevnad Sidebar',
        async () => {
          await laglistorButton.click()
          await page.waitForTimeout(500) // Wait for animation
        }
      )

      await page.screenshot({ path: 'screenshots/03-laglistor-expanded.png' })
    }

    // Navigate to Mina listor
    const minaEfterlevnad = page.locator('a:has-text("Mina listor")').first()
    if (await minaEfterlevnad.isVisible()) {
      await tracker.measureNavigation(
        page,
        '3.2 Navigate to Mina listor',
        async () => {
          await minaEfterlevnad.click()
          await page.waitForURL('**/laglistor', { timeout: 10000 })
        }
      )

      await page.screenshot({
        path: 'screenshots/03-mina-laglistor.png',
        fullPage: true,
      })

      // Look for law list items
      await page.waitForTimeout(2000) // Let content load
      const lawListItems = await page
        .locator(
          'tr[data-testid="law-list-item"], div[data-testid="law-list-item"], button:has-text("SFS"), td:has-text("SFS")'
        )
        .count()
      console.log(`  Found ${lawListItems} potential law list items`)

      // 4. LAW LIST ITEM MODAL PERFORMANCE
      console.log('\n📍 4. Law List Item Modal Performance')

      if (lawListItems > 0) {
        // Try to click on a law item (looking for document numbers like "1977:1160")
        const lawItem = page
          .locator(
            'button:has-text("SFS"), td:has-text("SFS"), a:has-text("SFS")'
          )
          .first()

        if (await lawItem.isVisible()) {
          // First modal open
          await tracker.measureNavigation(
            page,
            '4.1 First Modal Open (Critical Test)',
            async () => {
              await lawItem.click()
              await page.waitForSelector(
                '[role="dialog"], [data-radix-dialog-content]',
                { timeout: 15000 }
              )
            }
          )

          await page.screenshot({
            path: 'screenshots/04-modal-first-open.png',
            fullPage: true,
          })

          // Close modal
          await page.keyboard.press('Escape')
          await page.waitForTimeout(500)

          // Reopen same modal (should be cached)
          await tracker.measureNavigation(
            page,
            '4.2 Cached Modal Open',
            async () => {
              await lawItem.click()
              await page.waitForSelector(
                '[role="dialog"], [data-radix-dialog-content]',
                { timeout: 5000 }
              )
            }
          )

          await page.screenshot({
            path: 'screenshots/04-modal-cached-open.png',
          })

          // Close modal
          await page.keyboard.press('Escape')
          await page.waitForTimeout(500)
        }
      }
    }

    // 5. SETTINGS PAGE
    console.log('\n📍 5. Settings Page Performance')

    const settingsLink = page
      .locator('a:has-text("Inställningar"), nav a[href*="settings"]')
      .first()
    if (await settingsLink.isVisible()) {
      await tracker.measureNavigation(
        page,
        '5.1 Navigate to Settings',
        async () => {
          await settingsLink.click()
          await page.waitForURL('**/settings', { timeout: 10000 })
        }
      )

      await page.screenshot({
        path: 'screenshots/05-settings-page.png',
        fullPage: true,
      })
    }

    // 6. LEGAL SOURCES (RÄTTSKÄLLOR)
    console.log('\n📍 6. Legal Sources Browse Performance')

    // Try to expand Regelverk
    const rattskallor = page.locator('button:has-text("Regelverk")').first()
    if (await rattskallor.isVisible()) {
      await rattskallor.click()
      await page.waitForTimeout(300)

      // Navigate to browse
      const browseLink = page.locator('a:has-text("Bläddra alla")').first()
      if (await browseLink.isVisible()) {
        await tracker.measureNavigation(
          page,
          '6.1 Navigate to Browse All',
          async () => {
            await browseLink.click()
            await page.waitForURL('**/browse/rattskallor', { timeout: 10000 })
          }
        )

        await page.screenshot({
          path: 'screenshots/06-browse-all.png',
          fullPage: true,
        })
      }
    }

    // 7. TASKS PAGE (KNOWN PERFORMANCE ISSUES)
    console.log('\n📍 7. Tasks Page Performance (Regression Focus)')

    const tasksLink = page
      .locator('a:has-text("Uppgifter"), nav a[href*="tasks"]')
      .first()
    if (await tasksLink.isVisible()) {
      await tracker.measureNavigation(
        page,
        '7.1 Navigate to Tasks (CRITICAL)',
        async () => {
          await tasksLink.click()
          await page.waitForURL('**/tasks', { timeout: 15000 })
        }
      )

      // Check for UI responsiveness
      const tasksPageLoadStart = Date.now()
      await page.waitForLoadState('networkidle', { timeout: 20000 })
      const tasksPageFullLoad = Date.now() - tasksPageLoadStart
      console.log(`  ⚠️ Full tasks page load: ${tasksPageFullLoad}ms`)

      await page.screenshot({
        path: 'screenshots/07-tasks-page.png',
        fullPage: true,
      })

      // Test tab switching
      const tabs = await page.locator('[role="tab"]').all()
      if (tabs.length > 1) {
        const tabSwitchStart = Date.now()
        await tabs[1].click()
        await page.waitForTimeout(1000)
        const tabSwitchTime = Date.now() - tabSwitchStart
        console.log(`  Tab switch time: ${tabSwitchTime}ms`)
        await page.screenshot({ path: 'screenshots/07-tasks-tab-switch.png' })
      }
    }

    // 8. DASHBOARD RETURN
    console.log('\n📍 8. Dashboard Navigation (Cached)')

    const dashboardLink = page
      .locator('a:has-text("Dashboard"), nav a[href*="dashboard"]')
      .first()
    if (await dashboardLink.isVisible()) {
      await tracker.measureNavigation(
        page,
        '8.1 Return to Dashboard',
        async () => {
          await dashboardLink.click()
          await page.waitForURL('**/dashboard', { timeout: 10000 })
        }
      )

      await page.screenshot({
        path: 'screenshots/08-dashboard-return.png',
        fullPage: true,
      })
    }

    // GENERATE REPORT
    console.log('\n================================')
    console.log('📊 PERFORMANCE AUDIT SUMMARY')
    console.log('================================\n')

    const report = tracker.getReport()

    // Sort by duration
    report.sort((a, b) => b.totalDuration - a.totalDuration)

    console.log('🔴 Slowest Operations:')
    report.slice(0, 5).forEach((metric) => {
      const status =
        metric.totalDuration > 3000
          ? '🔴'
          : metric.totalDuration > 1000
            ? '🟡'
            : '🟢'
      console.log(`${status} ${metric.name}: ${metric.totalDuration}ms`)
    })

    console.log('\n📈 All Metrics:')
    report.forEach((metric) => {
      const status =
        metric.totalDuration > 3000
          ? '🔴'
          : metric.totalDuration > 1000
            ? '🟡'
            : '🟢'
      console.log(`${status} ${metric.name}: ${metric.totalDuration}ms`)
    })

    // Performance assertions
    const criticalIssues = report.filter((m) => m.totalDuration > 5000)
    const warnings = report.filter(
      (m) => m.totalDuration > 2000 && m.totalDuration <= 5000
    )

    console.log(`\n⚠️ Critical Issues (>5s): ${criticalIssues.length}`)
    criticalIssues.forEach((m) =>
      console.log(`   - ${m.name}: ${m.totalDuration}ms`)
    )

    console.log(`⚠️ Warnings (>2s): ${warnings.length}`)
    warnings.forEach((m) => console.log(`   - ${m.name}: ${m.totalDuration}ms`))

    // Expected vs Actual
    console.log('\n📋 Performance Targets:')
    console.log('  ❌ Target: All operations <1s')
    console.log('  ❌ Target: Modal opens <1s')
    console.log('  ❌ Target: Page navigation <1s')
    console.log(
      `  Actual: ${report.filter((m) => m.totalDuration < 1000).length}/${report.length} operations under 1s`
    )
  })
})
