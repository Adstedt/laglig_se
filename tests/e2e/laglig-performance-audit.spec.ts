import { test, expect, Page } from '@playwright/test'
import { PERFORMANCE_AUDIT_CONFIG } from './performance-audit-config'

/**
 * Comprehensive UX and Performance Audit for Laglig.se
 * 
 * This test suite performs a systematic performance audit covering:
 * - Workspace selector performance
 * - Law lists (Laglistor) navigation
 * - Law list item modal performance
 * - Settings page performance  
 * - Legal sources (Rättskällor) performance
 * - Tasks page performance and UI freeze detection
 * 
 * Measures timing, takes screenshots, and validates performance targets.
 */

// Use centralized configuration
const TEST_CONFIG = PERFORMANCE_AUDIT_CONFIG

// Performance measurement utilities
class PerformanceMeasurer {
  private measurements: Record<string, number> = {}
  private startTimes: Record<string, number> = {}
  
  start(label: string) {
    this.startTimes[label] = Date.now()
  }
  
  end(label: string): number {
    if (!this.startTimes[label]) {
      throw new Error(`No start time found for measurement: ${label}`)
    }
    const duration = Date.now() - this.startTimes[label]
    this.measurements[label] = duration
    delete this.startTimes[label]
    return duration
  }
  
  get(label: string): number | undefined {
    return this.measurements[label]
  }
  
  getAll(): Record<string, number> {
    return { ...this.measurements }
  }
  
  clear() {
    this.measurements = {}
    this.startTimes = {}
  }
}

// Authentication helper
async function authenticate(page: Page) {
  await page.goto(TEST_CONFIG.url)
  
  // Check if already logged in by looking for workspace elements
  const workspaceSelector = page.locator('[data-testid="workspace-switcher"], .workspace-selector, button:has-text("workspace")')
  if (await workspaceSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Already authenticated')
    return
  }
  
  // Look for login button or form
  const loginButton = page.locator(TEST_CONFIG.selectors.loginButton)
  if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginButton.click()
  }
  
  // Fill login form
  await page.waitForLoadState('networkidle')
  const emailInput = page.locator(TEST_CONFIG.selectors.emailInput).first()
  const passwordInput = page.locator(TEST_CONFIG.selectors.passwordInput).first()
  const submitButton = page.locator(TEST_CONFIG.selectors.submitButton).first()
  
  await emailInput.fill(TEST_CONFIG.credentials.email)
  await passwordInput.fill(TEST_CONFIG.credentials.password)
  await submitButton.click()
  
  // Wait for successful login - look for dashboard/workspace elements
  await page.waitForLoadState('networkidle')
  await expect(page.locator('body')).not.toContainText('Invalid', { timeout: 5000 })
}

// Screenshot helper with consistent naming
async function takeScreenshot(page: Page, name: string, fullPage: boolean = false) {
  const timestamp = new Date().toISOString().replace(/[:\.]/g, '-')
  const filename = `performance-audit-${name}-${timestamp}.png`
  await page.screenshot({ 
    path: `test-results/${filename}`,
    fullPage 
  })
  return filename
}

// Wait for loading states to complete
async function waitForStableUI(page: Page, timeout: number = 3000) {
  // Wait for common loading indicators to disappear
  const loadingSelectors = [
    '.loading', 
    '.spinner', 
    '[data-loading="true"]',
    '.skeleton',
    '.animate-pulse'
  ]
  
  for (const selector of loadingSelectors) {
    await page.locator(selector).waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {})
  }
  
  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout })
}

test.describe('Laglig.se Performance Audit', () => {
  let perf: PerformanceMeasurer
  
  test.beforeEach(async ({ page }) => {
    perf = new PerformanceMeasurer()
    
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1920, height: 1080 })
    
    // Enable performance monitoring
    await page.addInitScript(() => {
      // Add performance markers
      window.performanceMarks = []
      const originalMark = performance.mark
      performance.mark = function(name: string) {
        window.performanceMarks.push({ name, timestamp: Date.now() })
        return originalMark.call(this, name)
      }
    })
    
    await authenticate(page)
    
    // Take initial screenshot
    await takeScreenshot(page, 'initial-state')
  })

  test('1. Workspace Selector Performance', async ({ page }) => {
    // Navigate to dashboard if not already there
    await page.goto(`${TEST_CONFIG.url}/dashboard`)
    await waitForStableUI(page)
    
    // Find workspace selector
    const workspaceSelector = page.locator('[data-testid="workspace-switcher"]').or(
      page.locator('button:has-text("workspace")').or(
        page.locator('.workspace-selector')
      )
    ).first()
    
    await expect(workspaceSelector).toBeVisible()
    await takeScreenshot(page, 'workspace-selector-closed')
    
    // Measure workspace dropdown opening
    perf.start('workspace-dropdown-open')
    await workspaceSelector.click()
    
    // Wait for dropdown to be visible
    const dropdown = page.locator('[role="menu"], .dropdown-menu, .workspace-dropdown').first()
    await expect(dropdown).toBeVisible()
    const dropdownOpenTime = perf.end('workspace-dropdown-open')
    
    await takeScreenshot(page, 'workspace-selector-open')
    console.log(`Workspace dropdown open time: ${dropdownOpenTime}ms`)
    
    // Find available workspaces
    const workspaceItems = page.locator('[role="menuitem"], .workspace-item').or(
      dropdown.locator('button, a').filter({ hasText: /\w/ })
    )
    
    const workspaceCount = await workspaceItems.count()
    console.log(`Found ${workspaceCount} workspace options`)
    
    if (workspaceCount > 1) {
      // Test switching between workspaces
      for (let i = 0; i < Math.min(3, workspaceCount); i++) {
        const workspace = workspaceItems.nth(i)
        const workspaceName = await workspace.textContent() || `Workspace ${i}`
        
        console.log(`Testing switch to: ${workspaceName}`)
        
        perf.start(`workspace-switch-${i}`)
        await workspace.click()
        
        // Wait for context to load
        await waitForStableUI(page, 5000)
        const switchTime = perf.end(`workspace-switch-${i}`)
        
        console.log(`Workspace switch time for ${workspaceName}: ${switchTime}ms`)
        await takeScreenshot(page, `workspace-${i}-loaded`)
        
        // Validate performance target
        expect(switchTime).toBeLessThan(TEST_CONFIG.performanceTargets.workspaceSwitch)
        
        // Re-open dropdown for next iteration if not last
        if (i < Math.min(2, workspaceCount - 1)) {
          await workspaceSelector.click()
          await expect(dropdown).toBeVisible()
        }
      }
    }
  })

  test('2. Law Lists (Laglistor) Navigation Performance', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.url}/laglistor`)
    await waitForStableUI(page)
    
    await takeScreenshot(page, 'laglistor-initial')
    
    // Look for sidebar expansion
    const sidebar = page.locator('.sidebar, [data-testid="sidebar"], nav').first()
    
    if (await sidebar.isVisible()) {
      // Test sidebar expansion if it's collapsible
      const expandButton = page.locator('button:has([data-lucide="menu"]), .sidebar-toggle, [aria-label*="menu"]').first()
      
      if (await expandButton.isVisible().catch(() => false)) {
        perf.start('sidebar-expand')
        await expandButton.click()
        await waitForStableUI(page, 2000)
        const expandTime = perf.end('sidebar-expand')
        
        console.log(`Sidebar expansion time: ${expandTime}ms`)
        await takeScreenshot(page, 'sidebar-expanded')
      }
    }
    
    // Navigate to "Mina laglistor" or similar
    const myListsLink = page.locator('a:has-text("Mina laglistor"), a:has-text("My Lists"), a[href*="laglistor"]').first()
    
    if (await myListsLink.isVisible().catch(() => false)) {
      perf.start('my-lists-navigation')
      await myListsLink.click()
      await waitForStableUI(page)
      const navTime = perf.end('my-lists-navigation')
      
      console.log(`My Lists navigation time: ${navTime}ms`)
      await takeScreenshot(page, 'my-lists-loaded')
      
      expect(navTime).toBeLessThan(TEST_CONFIG.performanceTargets.listLoads)
    }
    
    // Find and test law list items
    const listItems = page.locator('.law-list-item, .list-item, tr, .card').filter({ hasText: /\w/ })
    const itemCount = await listItems.count()
    
    console.log(`Found ${itemCount} list items`)
    
    if (itemCount > 0) {
      // Test opening a specific law list
      const firstList = listItems.first()
      const listText = await firstList.textContent() || 'First List'
      
      perf.start('law-list-open')
      await firstList.click()
      await waitForStableUI(page)
      const openTime = perf.end('law-list-open')
      
      console.log(`Law list open time for "${listText}": ${openTime}ms`)
      await takeScreenshot(page, 'law-list-opened')
      
      expect(openTime).toBeLessThan(TEST_CONFIG.performanceTargets.listLoads)
      
      // Test table interactions if present
      const table = page.locator('table, .table, .data-table').first()
      
      if (await table.isVisible().catch(() => false)) {
        // Test sorting if sort buttons exist
        const sortButton = page.locator('th button, .sort-header, [aria-sort]').first()
        
        if (await sortButton.isVisible().catch(() => false)) {
          perf.start('table-sort')
          await sortButton.click()
          await waitForStableUI(page, 2000)
          const sortTime = perf.end('table-sort')
          
          console.log(`Table sort time: ${sortTime}ms`)
          await takeScreenshot(page, 'table-sorted')
        }
        
        // Test pagination if present
        const nextButton = page.locator('button:has-text("Next"), button:has-text("Nästa"), .pagination button').last()
        
        if (await nextButton.isVisible().catch(() => false)) {
          perf.start('table-pagination')
          await nextButton.click()
          await waitForStableUI(page, 2000)
          const paginationTime = perf.end('table-pagination')
          
          console.log(`Table pagination time: ${paginationTime}ms`)
          await takeScreenshot(page, 'table-paginated')
        }
      }
    }
  })

  test('3. Law List Item Modal Performance', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.url}/laglistor`)
    await waitForStableUI(page)
    
    // Find clickable law items that open modals
    const lawItems = page.locator('.law-item, .document-item, tr td:first-child, .card-title').filter({ hasText: /\w/ })
    const itemCount = await lawItems.count()
    
    console.log(`Found ${itemCount} potential law items`)
    
    if (itemCount > 0) {
      // Test first-time modal opening
      const firstItem = lawItems.first()
      const itemText = await firstItem.textContent() || 'First Item'
      
      console.log(`Testing modal for: ${itemText}`)
      
      perf.start('modal-first-open')
      await firstItem.click()
      
      // Wait for modal to appear
      const modal = page.locator('[role="dialog"], .modal, .dialog').first()
      await expect(modal).toBeVisible({ timeout: 5000 })
      const firstOpenTime = perf.end('modal-first-open')
      
      console.log(`Modal first open time: ${firstOpenTime}ms`)
      await takeScreenshot(page, 'modal-first-open', true)
      
      expect(firstOpenTime).toBeLessThan(TEST_CONFIG.performanceTargets.modalFirstOpen)
      
      // Close modal
      const closeButton = page.locator('button[aria-label="Close"], button:has-text("×"), .modal-close').first()
      
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click()
        await expect(modal).toBeHidden()
      } else {
        // Try escape key
        await page.keyboard.press('Escape')
        await expect(modal).toBeHidden()
      }
      
      // Test cached reopening
      await page.waitForTimeout(500) // Brief pause
      
      perf.start('modal-cached-open')
      await firstItem.click()
      await expect(modal).toBeVisible()
      const cachedOpenTime = perf.end('modal-cached-open')
      
      console.log(`Modal cached open time: ${cachedOpenTime}ms`)
      await takeScreenshot(page, 'modal-cached-open', true)
      
      expect(cachedOpenTime).toBeLessThan(TEST_CONFIG.performanceTargets.modalCached)
      
      // Close modal again
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click()
      } else {
        await page.keyboard.press('Escape')
      }
      
      // Test multiple different modals if available
      for (let i = 1; i < Math.min(3, itemCount); i++) {
        const item = lawItems.nth(i)
        const text = await item.textContent() || `Item ${i}`
        
        console.log(`Testing modal ${i + 1} for: ${text}`)
        
        perf.start(`modal-${i}-open`)
        await item.click()
        await expect(modal).toBeVisible({ timeout: 3000 })
        const openTime = perf.end(`modal-${i}-open`)
        
        console.log(`Modal ${i + 1} open time: ${openTime}ms`)
        await takeScreenshot(page, `modal-${i}-open`)
        
        // Close before next iteration
        if (await closeButton.isVisible().catch(() => false)) {
          await closeButton.click()
        } else {
          await page.keyboard.press('Escape')
        }
        
        await expect(modal).toBeHidden()
      }
    }
  })

  test('4. Settings (Inställningar) Page Performance', async ({ page }) => {
    // Navigate to settings
    perf.start('settings-navigation')
    await page.goto(`${TEST_CONFIG.url}/settings`)
    await waitForStableUI(page)
    const navTime = perf.end('settings-navigation')
    
    console.log(`Settings page navigation time: ${navTime}ms`)
    await takeScreenshot(page, 'settings-loaded', true)
    
    expect(navTime).toBeLessThan(TEST_CONFIG.performanceTargets.pageNavigations)
    
    // Find settings tabs
    const tabs = page.locator('[role="tab"], .tab, .settings-tab').filter({ hasText: /\w/ })
    const tabCount = await tabs.count()
    
    console.log(`Found ${tabCount} settings tabs`)
    
    if (tabCount > 1) {
      // Test each tab's load time
      for (let i = 0; i < Math.min(5, tabCount); i++) {
        const tab = tabs.nth(i)
        const tabText = await tab.textContent() || `Tab ${i}`
        
        console.log(`Testing tab: ${tabText}`)
        
        perf.start(`tab-${i}-load`)
        await tab.click()
        await waitForStableUI(page, 3000)
        const tabLoadTime = perf.end(`tab-${i}-load`)
        
        console.log(`Tab "${tabText}" load time: ${tabLoadTime}ms`)
        await takeScreenshot(page, `settings-tab-${i}`)
        
        // Tab switches should be fast
        expect(tabLoadTime).toBeLessThan(TEST_CONFIG.performanceTargets.listLoads)
      }
    }
    
    // Test settings form interactions
    const formInputs = page.locator('input, select, textarea').filter({ hasText: /\w/ })
    const inputCount = await formInputs.count()
    
    if (inputCount > 0) {
      console.log(`Testing ${inputCount} form inputs for responsiveness`)
      
      // Test first few inputs for responsiveness
      for (let i = 0; i < Math.min(3, inputCount); i++) {
        const input = formInputs.nth(i)
        
        if (await input.isVisible().catch(() => false)) {
          perf.start(`input-${i}-response`)
          await input.click()
          await input.fill('test')
          const responseTime = perf.end(`input-${i}-response`)
          
          console.log(`Input ${i} response time: ${responseTime}ms`)
          
          // Clear the input
          await input.fill('')
        }
      }
    }
  })

  test('5. Legal Sources (Rättskällor) Performance', async ({ page }) => {
    // Navigate to legal sources
    perf.start('legal-sources-navigation')
    await page.goto(`${TEST_CONFIG.url}/rattskallor`)
    await waitForStableUI(page)
    const navTime = perf.end('legal-sources-navigation')
    
    console.log(`Legal sources navigation time: ${navTime}ms`)
    await takeScreenshot(page, 'legal-sources-loaded', true)
    
    expect(navTime).toBeLessThan(TEST_CONFIG.performanceTargets.pageNavigations)
    
    // Browse results
    const results = page.locator('.result-item, .search-result, .card, article').filter({ hasText: /\w/ })
    const resultCount = await results.count()
    
    console.log(`Found ${resultCount} legal source results`)
    
    if (resultCount > 0) {
      // Test browsing between resources
      for (let i = 0; i < Math.min(3, resultCount); i++) {
        const result = results.nth(i)
        const resultText = await result.textContent() || `Result ${i}`
        
        console.log(`Testing navigation to: ${resultText.substring(0, 50)}...`)
        
        perf.start(`legal-source-${i}-open`)
        await result.click()
        await waitForStableUI(page, 5000)
        const openTime = perf.end(`legal-source-${i}-open`)
        
        console.log(`Legal source ${i} open time: ${openTime}ms`)
        await takeScreenshot(page, `legal-source-${i}-loaded`)
        
        expect(openTime).toBeLessThan(TEST_CONFIG.performanceTargets.pageNavigations)
        
        // Test repeat visit (back and forward)
        if (i < Math.min(2, resultCount - 1)) {
          perf.start(`legal-source-${i}-back`)
          await page.goBack()
          await waitForStableUI(page, 3000)
          const backTime = perf.end(`legal-source-${i}-back`)
          
          console.log(`Legal source ${i} back navigation time: ${backTime}ms`)
          
          perf.start(`legal-source-${i}-forward`)
          await page.goForward()
          await waitForStableUI(page, 3000)
          const forwardTime = perf.end(`legal-source-${i}-forward`)
          
          console.log(`Legal source ${i} forward navigation time: ${forwardTime}ms`)
          
          // Go back to results page for next iteration
          await page.goBack()
          await waitForStableUI(page)
        }
      }
    }
    
    // Test search functionality if available
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="sök"]').first()
    
    if (await searchInput.isVisible().catch(() => false)) {
      console.log('Testing search performance')
      
      perf.start('search-query')
      await searchInput.fill('arbetsmiljö')
      await searchInput.press('Enter')
      await waitForStableUI(page, 5000)
      const searchTime = perf.end('search-query')
      
      console.log(`Search query time: ${searchTime}ms`)
      await takeScreenshot(page, 'search-results-loaded')
      
      expect(searchTime).toBeLessThan(TEST_CONFIG.performanceTargets.pageNavigations)
    }
  })

  test('6. Tasks (Uppgifter) Page Performance and UI Freeze Detection', async ({ page }) => {
    // Navigate to tasks page
    perf.start('tasks-navigation')
    await page.goto(`${TEST_CONFIG.url}/tasks`)
    
    // Monitor for UI freezes during load
    const freezeStartTime = Date.now()
    let uiFreezeDetected = false
    let maxFreezeTime = 0
    
    // Check for responsiveness every 50ms
    const freezeCheckInterval = setInterval(async () => {
      const checkStart = Date.now()
      try {
        // Try to interact with the page - this will hang if UI is frozen
        await page.locator('body').hover({ timeout: 20 })
        const checkTime = Date.now() - checkStart
        
        if (checkTime > TEST_CONFIG.performanceTargets.maxFreezeTime) {
          uiFreezeDetected = true
          maxFreezeTime = Math.max(maxFreezeTime, checkTime)
          console.log(`UI freeze detected: ${checkTime}ms`)
        }
      } catch (error) {
        // Interaction failed - likely a freeze
        const checkTime = Date.now() - checkStart
        uiFreezeDetected = true
        maxFreezeTime = Math.max(maxFreezeTime, checkTime)
      }
    }, 50)
    
    await waitForStableUI(page, 10000)
    clearInterval(freezeCheckInterval)
    
    const navTime = perf.end('tasks-navigation')
    
    console.log(`Tasks page navigation time: ${navTime}ms`)
    console.log(`UI freeze detected: ${uiFreezeDetected}`)
    console.log(`Max freeze time: ${maxFreezeTime}ms`)
    
    await takeScreenshot(page, 'tasks-loaded', true)
    
    expect(navTime).toBeLessThan(TEST_CONFIG.performanceTargets.pageNavigations)
    expect(maxFreezeTime).toBeLessThan(TEST_CONFIG.performanceTargets.maxFreezeTime * 2) // Allow some tolerance
    
    // Test task interactions
    const taskItems = page.locator('.task-item, .card, tr').filter({ hasText: /\w/ })
    const taskCount = await taskItems.count()
    
    console.log(`Found ${taskCount} task items`)
    
    if (taskCount > 0) {
      // Test task opening
      const firstTask = taskItems.first()
      const taskText = await firstTask.textContent() || 'First Task'
      
      console.log(`Testing task interaction: ${taskText.substring(0, 50)}...`)
      
      perf.start('task-interaction')
      await firstTask.click()
      await waitForStableUI(page, 3000)
      const interactionTime = perf.end('task-interaction')
      
      console.log(`Task interaction time: ${interactionTime}ms`)
      await takeScreenshot(page, 'task-opened')
      
      expect(interactionTime).toBeLessThan(TEST_CONFIG.performanceTargets.listLoads)
    }
    
    // Test task creation if button exists
    const createTaskButton = page.locator('button:has-text("Create"), button:has-text("Skapa"), .create-task, [aria-label*="create"]').first()
    
    if (await createTaskButton.isVisible().catch(() => false)) {
      console.log('Testing task creation flow')
      
      perf.start('task-creation-modal')
      await createTaskButton.click()
      
      const modal = page.locator('[role="dialog"], .modal').first()
      await expect(modal).toBeVisible({ timeout: 3000 })
      const modalOpenTime = perf.end('task-creation-modal')
      
      console.log(`Task creation modal time: ${modalOpenTime}ms`)
      await takeScreenshot(page, 'task-creation-modal')
      
      expect(modalOpenTime).toBeLessThan(TEST_CONFIG.performanceTargets.modalFirstOpen)
      
      // Close modal
      const closeButton = page.locator('button[aria-label="Close"], button:has-text("×")').first()
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click()
      } else {
        await page.keyboard.press('Escape')
      }
    }
  })

  test('7. Generate Performance Report', async ({ page }) => {
    // Collect all measurements
    const allMeasurements = perf.getAll()
    
    // Get browser performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        largestContentfulPaint: performance.getEntriesByName('largest-contentful-paint')[0]?.startTime || 0
      }
    })
    
    // Generate performance report
    const report = {
      timestamp: new Date().toISOString(),
      testConfiguration: TEST_CONFIG,
      performanceMetrics,
      measurements: allMeasurements,
      summary: {
        totalTests: Object.keys(allMeasurements).length,
        passedTargets: 0,
        failedTargets: 0,
        averageResponseTime: 0
      }
    }
    
    // Analyze results
    const responseTimeSum = Object.values(allMeasurements).reduce((sum, time) => sum + time, 0)
    report.summary.averageResponseTime = responseTimeSum / Object.keys(allMeasurements).length
    
    // Check against targets
    Object.entries(allMeasurements).forEach(([key, value]) => {
      let target = TEST_CONFIG.performanceTargets.pageNavigations // default
      
      if (key.includes('workspace-switch')) target = TEST_CONFIG.performanceTargets.workspaceSwitch
      else if (key.includes('modal') && key.includes('first')) target = TEST_CONFIG.performanceTargets.modalFirstOpen
      else if (key.includes('modal') && key.includes('cached')) target = TEST_CONFIG.performanceTargets.modalCached
      else if (key.includes('list') || key.includes('tab')) target = TEST_CONFIG.performanceTargets.listLoads
      
      if (value <= target) {
        report.summary.passedTargets++
      } else {
        report.summary.failedTargets++
      }
    })
    
    // Save report
    const reportJson = JSON.stringify(report, null, 2)
    
    console.log('=== PERFORMANCE AUDIT REPORT ===')
    console.log(reportJson)
    
    // Take final summary screenshot
    await takeScreenshot(page, 'audit-complete')
    
    // Validate overall performance
    expect(report.summary.failedTargets).toBeLessThan(report.summary.totalTests * 0.3) // Allow 30% failure rate
    expect(report.summary.averageResponseTime).toBeLessThan(1000) // Overall average should be under 1s
  })
})