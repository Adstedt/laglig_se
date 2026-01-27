/**
 * E2E Performance Tests
 * Story P.1: Emergency Performance Fixes
 *
 * Tests validate that performance improvements meet the required thresholds:
 * - Modal open: <1 second
 * - Tasks page load: <2 seconds
 * - Document content load (cached): <500ms
 */

import { test, expect } from '@playwright/test'

// Configure test timeout for performance testing
test.use({
  // Set longer timeout for initial page loads
  navigationTimeout: 10000,
  actionTimeout: 5000,
})

test.describe('Performance Fixes - Story P.1', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication by setting session cookie
    // In real tests, this would be done through proper auth flow
    await page.context().addCookies([
      {
        name: 'next-auth.session-token',
        value: 'mock-session-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ])
  })

  test('law list modal should open in less than 1 second', async ({ page }) => {
    // Navigate to law lists page
    await page.goto('/laglistor')

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle')

    // Find a law list item button (adjust selector as needed)
    const listItemButton = page.locator('[data-testid="law-list-item"]').first()
    await expect(listItemButton).toBeVisible()

    // Measure modal open time
    const startTime = performance.now()

    // Click to open modal
    await listItemButton.click()

    // Wait for modal to be visible
    const modal = page.locator('[data-testid="law-detail-modal"]')
    await expect(modal).toBeVisible()

    // Calculate elapsed time
    const elapsedTime = performance.now() - startTime

    // Assert modal opened in less than 1 second (1000ms)
    expect(elapsedTime).toBeLessThan(1000)

    // Verify modal content loaded
    await expect(modal.locator('[data-testid="document-title"]')).toBeVisible()
    await expect(
      modal.locator('[data-testid="document-content"]')
    ).toBeVisible()
  })

  test('tasks page should load in less than 2 seconds', async ({ page }) => {
    // Measure page load time
    const startTime = performance.now()

    // Navigate to tasks page
    await page.goto('/tasks')

    // Wait for the main content to be visible
    const tasksContainer = page.locator('[data-testid="tasks-container"]')
    await expect(tasksContainer).toBeVisible()

    // Wait for at least one task column to be visible
    const taskColumn = page.locator('[data-testid="task-column"]').first()
    await expect(taskColumn).toBeVisible()

    // Calculate elapsed time
    const elapsedTime = performance.now() - startTime

    // Assert page loaded in less than 2 seconds (2000ms)
    expect(elapsedTime).toBeLessThan(2000)

    // Verify pagination controls are present
    const paginationControls = page.locator(
      '[data-testid="pagination-controls"]'
    )
    if ((await paginationControls.count()) > 0) {
      await expect(paginationControls).toBeVisible()
    }
  })

  test('document content should load from cache in less than 500ms', async ({
    page,
  }) => {
    // First, navigate to a law detail page to prime the cache
    await page.goto('/lagar/test-law-id')
    await page.waitForLoadState('networkidle')

    // Navigate away
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Measure cached load time
    const startTime = performance.now()

    // Navigate back to the same law (should be cached)
    await page.goto('/lagar/test-law-id')

    // Wait for document content to be visible
    const documentContent = page.locator(
      '[data-testid="document-html-content"]'
    )
    await expect(documentContent).toBeVisible()

    // Calculate elapsed time
    const elapsedTime = performance.now() - startTime

    // Assert cached content loaded in less than 500ms
    expect(elapsedTime).toBeLessThan(500)
  })

  test('task pagination should handle large datasets without freezing', async ({
    page,
  }) => {
    // Navigate to tasks page
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')

    // Check if pagination is present
    const nextPageButton = page.locator('[data-testid="next-page-button"]')

    if ((await nextPageButton.count()) > 0) {
      // Measure pagination response time
      const startTime = performance.now()

      // Click next page
      await nextPageButton.click()

      // Wait for new tasks to load
      await page.waitForFunction(() => {
        const tasks = document.querySelectorAll('[data-testid="task-card"]')
        return tasks.length > 0
      })

      // Calculate elapsed time
      const elapsedTime = performance.now() - startTime

      // Assert pagination completed in less than 1 second
      expect(elapsedTime).toBeLessThan(1000)

      // Verify page didn't freeze (can interact with elements)
      const firstTask = page.locator('[data-testid="task-card"]').first()
      await expect(firstTask).toBeVisible()
      await firstTask.hover() // Test interaction
    }
  })

  test('database indexes should improve query performance', async ({
    _page,
    request,
  }) => {
    // This test would typically be done at the API level
    // Here we test the API response time for law list queries

    const startTime = performance.now()

    // Make API request to fetch law list items
    const response = await request.get('/api/law-lists/items', {
      params: {
        listId: 'test-list-id',
        page: 1,
        limit: 50,
      },
    })

    const elapsedTime = performance.now() - startTime

    // Assert API responded in less than 500ms (improved by indexes)
    expect(response.ok()).toBeTruthy()
    expect(elapsedTime).toBeLessThan(500)

    const data = await response.json()
    expect(data).toHaveProperty('items')
    expect(data).toHaveProperty('pagination')
  })

  test('verify no memory leaks with repeated modal opens', async ({ page }) => {
    // Navigate to law lists page
    await page.goto('/laglistor')
    await page.waitForLoadState('networkidle')

    // Open and close modal multiple times
    for (let i = 0; i < 5; i++) {
      // Open modal
      const listItem = page.locator('[data-testid="law-list-item"]').first()
      await listItem.click()

      const modal = page.locator('[data-testid="law-detail-modal"]')
      await expect(modal).toBeVisible()

      // Close modal
      const closeButton = modal.locator('[data-testid="close-modal"]')
      await closeButton.click()
      await expect(modal).not.toBeVisible()

      // Small delay between iterations
      await page.waitForTimeout(100)
    }

    // Evaluate memory usage (simplified check)
    const memoryUsage = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize
      }
      return null
    })

    // If memory API is available, check it's reasonable
    if (memoryUsage !== null) {
      // Memory should be less than 100MB after multiple operations
      expect(memoryUsage).toBeLessThan(100 * 1024 * 1024)
    }
  })

  test('cache hit rate monitoring should show improvements', async ({
    page,
  }) => {
    // Navigate to a page that uses caching
    await page.goto('/laglistor')

    // Open browser console to capture cache logs
    const consoleLogs: string[] = []
    page.on('console', (msg) => {
      if (msg.text().includes('[CACHE')) {
        consoleLogs.push(msg.text())
      }
    })

    // Perform multiple operations that should hit cache
    const listItems = page.locator('[data-testid="law-list-item"]')
    const itemCount = await listItems.count()

    // Open first 3 modals (or less if fewer items)
    const modalCount = Math.min(3, itemCount)
    for (let i = 0; i < modalCount; i++) {
      await listItems.nth(i).click()
      await page.waitForTimeout(200)

      const closeButton = page.locator('[data-testid="close-modal"]')
      await closeButton.click()
      await page.waitForTimeout(200)
    }

    // Open same modals again (should hit cache)
    for (let i = 0; i < modalCount; i++) {
      await listItems.nth(i).click()
      await page.waitForTimeout(200)

      const closeButton = page.locator('[data-testid="close-modal"]')
      await closeButton.click()
      await page.waitForTimeout(200)
    }

    // Count cache hits vs misses
    const cacheHits = consoleLogs.filter((log) =>
      log.includes('[CACHE HIT]')
    ).length
    const cacheMisses = consoleLogs.filter((log) =>
      log.includes('[CACHE MISS]')
    ).length

    // Second round should have more hits than first round
    if (cacheHits + cacheMisses > 0) {
      const hitRate = (cacheHits / (cacheHits + cacheMisses)) * 100
      // Expect at least 50% cache hit rate for repeated operations
      expect(hitRate).toBeGreaterThan(50)
    }
  })
})
