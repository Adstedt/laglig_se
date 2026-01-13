import { test, expect, Page } from '@playwright/test'

// Test configuration
const BASE_URL = 'https://laglig-se.vercel.app'
const TEST_ACCOUNT = {
  email: 'alexander.adstedt+10@kontorab.se',
  password: 'KBty8611!!!!'
}

// Performance measurement helper
class PerformanceTracker {
  private metrics: Map<string, any> = new Map()
  
  async measureNavigation(page: Page, name: string, action: () => Promise<void>) {
    const startTime = Date.now()
    
    // Start measuring
    await page.evaluate(() => performance.mark('nav-start'))
    
    // Execute action
    await action()
    
    // Wait for network idle and content
    await page.waitForLoadState('networkidle')
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    // Get additional metrics
    const performanceMetrics = await page.evaluate(() => {
      performance.mark('nav-end')
      performance.measure('navigation', 'nav-start', 'nav-end')
      const measure = performance.getEntriesByName('navigation')[0]
      
      return {
        duration: measure?.duration || 0,
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
      }
    })
    
    const metrics = {
      name,
      totalDuration: duration,
      ...performanceMetrics,
      timestamp: new Date().toISOString()
    }
    
    this.metrics.set(name, metrics)
    console.log(`📊 ${name}: ${duration}ms`)
    
    return metrics
  }
  
  getReport() {
    return Array.from(this.metrics.values())
  }
}

test.describe('Laglig.se Performance Audit', () => {
  let tracker: PerformanceTracker
  
  test.beforeEach(async ({ page }) => {
    tracker = new PerformanceTracker()
    
    // Set viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    // Enable performance tracking
    await page.evaluateOnNewDocument(() => {
      window.performanceMetrics = []
    })
  })
  
  test('Complete Performance Audit', async ({ page }) => {
    console.log('🚀 Starting Laglig.se Performance Audit')
    console.log('================================')
    
    // 1. LOGIN AND INITIAL LOAD
    console.log('\n📍 1. Login Performance')
    
    await tracker.measureNavigation(page, '1.1 Initial Page Load', async () => {
      await page.goto(BASE_URL)
    })
    
    // Check if we need to login
    const isLoggedIn = await page.locator('[data-testid="workspace-switcher"]').isVisible().catch(() => false)
    
    if (!isLoggedIn) {
      await tracker.measureNavigation(page, '1.2 Login Process', async () => {
        await page.goto(`${BASE_URL}/login`)
        await page.fill('input[type="email"]', TEST_ACCOUNT.email)
        await page.fill('input[type="password"]', TEST_ACCOUNT.password)
        await page.click('button[type="submit"]')
        await page.waitForURL('**/dashboard')
      })
    }
    
    await page.screenshot({ path: 'screenshots/01-dashboard-initial.png' })
    
    // 2. WORKSPACE SELECTOR PERFORMANCE
    console.log('\n📍 2. Workspace Selector Performance')
    
    // Open workspace dropdown
    const workspaceSwitcherStart = Date.now()
    await page.click('[data-testid="workspace-switcher"]')
    await page.waitForSelector('[role="menuitem"]')
    const workspaceSwitcherOpen = Date.now() - workspaceSwitcherStart
    console.log(`  Dropdown open time: ${workspaceSwitcherOpen}ms`)
    
    await page.screenshot({ path: 'screenshots/02-workspace-dropdown.png' })
    
    // Get available workspaces
    const workspaces = await page.locator('[role="menuitem"]').all()
    console.log(`  Found ${workspaces.length} workspaces`)
    
    // Switch to Grro Technologies if available
    const grroWorkspace = await page.locator('[role="menuitem"]:has-text("Grro Technologies")').first()
    if (await grroWorkspace.isVisible()) {
      await tracker.measureNavigation(page, '2.1 Switch to Grro Technologies', async () => {
        await grroWorkspace.click()
        await page.waitForLoadState('networkidle')
      })
      await page.screenshot({ path: 'screenshots/02-grro-workspace.png' })
    }
    
    // 3. LAW LISTS (LAGLISTOR) NAVIGATION
    console.log('\n📍 3. Law Lists Navigation & Performance')
    
    // Expand Laglistor in sidebar
    const laglistorButton = page.locator('button:has-text("Laglistor")')
    await tracker.measureNavigation(page, '3.1 Expand Laglistor Sidebar', async () => {
      await laglistorButton.click()
      await page.waitForTimeout(500) // Wait for animation
    })
    
    await page.screenshot({ path: 'screenshots/03-laglistor-expanded.png' })
    
    // Navigate to Mina laglistor
    await tracker.measureNavigation(page, '3.2 Navigate to Mina laglistor', async () => {
      await page.click('a:has-text("Mina laglistor")')
      await page.waitForURL('**/laglistor')
    })
    
    await page.screenshot({ path: 'screenshots/03-mina-laglistor.png' })
    
    // Check if there are law lists
    const lawListItems = await page.locator('[data-testid="law-list-item"]').count()
    console.log(`  Found ${lawListItems} law list items`)
    
    // 4. LAW LIST ITEM MODAL PERFORMANCE
    console.log('\n📍 4. Law List Item Modal Performance')
    
    if (lawListItems > 0) {
      // First modal open
      await tracker.measureNavigation(page, '4.1 First Modal Open', async () => {
        await page.locator('[data-testid="law-list-item"]').first().click()
        await page.waitForSelector('[role="dialog"]')
      })
      
      await page.screenshot({ path: 'screenshots/04-modal-first-open.png' })
      
      // Close modal
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      
      // Reopen same modal (should be cached)
      await tracker.measureNavigation(page, '4.2 Cached Modal Open', async () => {
        await page.locator('[data-testid="law-list-item"]').first().click()
        await page.waitForSelector('[role="dialog"]')
      })
      
      await page.screenshot({ path: 'screenshots/04-modal-cached-open.png' })
      
      // Close modal
      await page.keyboard.press('Escape')
    }
    
    // 5. SETTINGS PAGE
    console.log('\n📍 5. Settings Page Performance')
    
    await tracker.measureNavigation(page, '5.1 Navigate to Settings', async () => {
      await page.click('a:has-text("Inställningar")')
      await page.waitForURL('**/settings')
    })
    
    await page.screenshot({ path: 'screenshots/05-settings-page.png' })
    
    // 6. LEGAL SOURCES (RÄTTSKÄLLOR)
    console.log('\n📍 6. Legal Sources Browse Performance')
    
    // Expand Rättskällor
    await page.click('button:has-text("Rättskällor")')
    await page.waitForTimeout(300)
    
    // Navigate to browse
    await tracker.measureNavigation(page, '6.1 Navigate to Browse All', async () => {
      await page.click('a:has-text("Bläddra alla")')
      await page.waitForURL('**/browse/rattskallor')
    })
    
    await page.screenshot({ path: 'screenshots/06-browse-all.png' })
    
    // Navigate to specific law type
    await tracker.measureNavigation(page, '6.2 Navigate to Svenska lagar', async () => {
      await page.click('a:has-text("Svenska lagar")')
      await page.waitForURL('**/browse/lagar')
    })
    
    await page.screenshot({ path: 'screenshots/06-svenska-lagar.png' })
    
    // 7. TASKS PAGE (KNOWN PERFORMANCE ISSUES)
    console.log('\n📍 7. Tasks Page Performance (Regression Focus)')
    
    await tracker.measureNavigation(page, '7.1 Navigate to Tasks', async () => {
      await page.click('a:has-text("Uppgifter")')
      await page.waitForURL('**/tasks')
    })
    
    // Check for UI responsiveness
    const tasksPageLoadStart = Date.now()
    await page.waitForLoadState('networkidle')
    const tasksPageFullLoad = Date.now() - tasksPageLoadStart
    console.log(`  Full tasks page load: ${tasksPageFullLoad}ms`)
    
    await page.screenshot({ path: 'screenshots/07-tasks-page.png' })
    
    // Test tab switching
    const tabs = await page.locator('[role="tab"]').all()
    if (tabs.length > 1) {
      const tabSwitchStart = Date.now()
      await tabs[1].click()
      await page.waitForTimeout(500)
      const tabSwitchTime = Date.now() - tabSwitchStart
      console.log(`  Tab switch time: ${tabSwitchTime}ms`)
    }
    
    // 8. DASHBOARD RETURN
    console.log('\n📍 8. Dashboard Navigation (Cached)')
    
    await tracker.measureNavigation(page, '8.1 Return to Dashboard', async () => {
      await page.click('a:has-text("Dashboard")')
      await page.waitForURL('**/dashboard')
    })
    
    await page.screenshot({ path: 'screenshots/08-dashboard-return.png' })
    
    // GENERATE REPORT
    console.log('\n================================')
    console.log('📊 PERFORMANCE AUDIT SUMMARY')
    console.log('================================\n')
    
    const report = tracker.getReport()
    
    // Sort by duration
    report.sort((a, b) => b.totalDuration - a.totalDuration)
    
    console.log('🔴 Slowest Operations:')
    report.slice(0, 5).forEach(metric => {
      const status = metric.totalDuration > 1000 ? '🔴' : metric.totalDuration > 500 ? '🟡' : '🟢'
      console.log(`${status} ${metric.name}: ${metric.totalDuration}ms`)
    })
    
    console.log('\n📈 All Metrics:')
    report.forEach(metric => {
      console.log(`- ${metric.name}: ${metric.totalDuration}ms`)
    })
    
    // Performance assertions
    const criticalIssues = report.filter(m => m.totalDuration > 2000)
    const warnings = report.filter(m => m.totalDuration > 1000 && m.totalDuration <= 2000)
    
    console.log(`\n⚠️ Critical Issues (>2s): ${criticalIssues.length}`)
    console.log(`⚠️ Warnings (>1s): ${warnings.length}`)
    
    // Save detailed report
    await page.evaluate((reportData) => {
      console.table(reportData)
    }, report)
  })
})