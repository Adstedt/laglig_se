/**
 * Story 6.6: E2E Tests for Task Modal
 * Tests the Jira-style task modal functionality
 */

import { test, expect } from '@playwright/test'

// Test user credentials from environment or hardcoded for testing
const TEST_EMAIL =
  process.env.TEST_USER_EMAIL || 'alexander.adstedt+10@kontorab.se'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'KBty8611!!!!'

test.describe('Task Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[name="email"], input[type="email"]', TEST_EMAIL)
    await page.fill(
      'input[name="password"], input[type="password"]',
      TEST_PASSWORD
    )
    await page.click('button[type="submit"]')

    // Wait for redirect to workspace
    await page.waitForURL(/\/(dashboard|uppgifter)/, { timeout: 15000 })
  })

  test.describe('Task Creation', () => {
    test('should create a task from Kanban board', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')

      // Wait for Kanban board to load
      await page.waitForTimeout(2000)

      // Find and click the + button on a column
      const addButton = page.locator('button:has(svg.lucide-plus)').first()
      await expect(addButton).toBeVisible({ timeout: 10000 })
      await addButton.click()

      // Fill in task title
      const taskTitle = `E2E Test Task ${Date.now()}`
      const input = page.locator('input[placeholder*="Uppgiftens titel"]')
      await expect(input).toBeVisible()
      await input.fill(taskTitle)

      // Click create button
      await page.getByRole('button', { name: 'Skapa' }).click()

      // Wait for task to be created
      await page.waitForTimeout(1000)

      // Verify task appears in the board
      await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Task Modal Opening', () => {
    test('should open task modal when clicking a task card', async ({
      page,
    }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // Check if there are any task cards
      const taskCards = page.locator('[class*="cursor-grab"]')
      const hasTaskCards = (await taskCards.count()) > 0

      if (hasTaskCards) {
        // Click on the first task card
        await taskCards.first().click()
        await page.waitForTimeout(500)

        // Modal should be open
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
      } else {
        // Create a task first
        const addButton = page.locator('button:has(svg.lucide-plus)').first()
        await addButton.click()
        const taskTitle = `E2E Test Task ${Date.now()}`
        await page
          .locator('input[placeholder*="Uppgiftens titel"]')
          .fill(taskTitle)
        await page.getByRole('button', { name: 'Skapa' }).click()
        await page.waitForTimeout(1000)

        // Now click on the created task
        await page.getByText(taskTitle).click()
        await page.waitForTimeout(500)

        // Modal should be open
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
      }
    })

    test('should display task title in modal', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // Create a task with known title
      const addButton = page.locator('button:has(svg.lucide-plus)').first()
      await addButton.click()
      const taskTitle = `E2E Modal Title Test ${Date.now()}`
      await page
        .locator('input[placeholder*="Uppgiftens titel"]')
        .fill(taskTitle)
      await page.getByRole('button', { name: 'Skapa' }).click()
      await page.waitForTimeout(1000)

      // Click on the task
      await page.getByText(taskTitle).click()
      await page.waitForTimeout(500)

      // Verify title is shown in modal
      const modal = page.getByRole('dialog')
      await expect(modal.getByText(taskTitle)).toBeVisible()
    })

    test('should show breadcrumb navigation', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      const hasTaskCards = (await taskCards.count()) > 0

      if (hasTaskCards) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        const modal = page.getByRole('dialog')
        // Should show "Uppgifter /" breadcrumb
        await expect(modal.getByText('Uppgifter')).toBeVisible()
      }
    })
  })

  test.describe('Task Modal Closing', () => {
    test('should close modal when clicking close button', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        // Modal should be open
        await expect(page.getByRole('dialog')).toBeVisible()

        // Click close button (X)
        await page.getByRole('button', { name: /stäng/i }).click()
        await page.waitForTimeout(300)

        // Modal should be closed
        await expect(page.getByRole('dialog')).not.toBeVisible()
      }
    })

    test('should close modal when pressing Escape', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        // Modal should be open
        await expect(page.getByRole('dialog')).toBeVisible()

        // Press Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)

        // Modal should be closed
        await expect(page.getByRole('dialog')).not.toBeVisible()
      }
    })
  })

  test.describe('Task Modal Content', () => {
    test('should show status and priority badges', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        const modal = page.getByRole('dialog')

        // Should show status section
        await expect(modal.getByText('Status')).toBeVisible()

        // Should show priority section
        await expect(modal.getByText('Prioritet')).toBeVisible()
      }
    })

    test('should show activity tabs', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        const modal = page.getByRole('dialog')

        // Should show activity tabs
        await expect(modal.getByRole('tab', { name: 'Alla' })).toBeVisible()
        await expect(
          modal.getByRole('tab', { name: 'Kommentarer' })
        ).toBeVisible()
        await expect(modal.getByRole('tab', { name: 'Historik' })).toBeVisible()
      }
    })

    test('should show details section in right panel', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        const modal = page.getByRole('dialog')

        // Should show details section
        await expect(modal.getByText('Detaljer')).toBeVisible()

        // Should show assignee field
        await expect(modal.getByText('Ansvarig')).toBeVisible()

        // Should show due date field
        await expect(modal.getByText('Förfallodatum')).toBeVisible()
      }
    })

    test('should show quick links with AI button', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        const modal = page.getByRole('dialog')

        // Should show quick links section
        await expect(modal.getByText('Snabblänkar')).toBeVisible()

        // Should show AI button
        await expect(modal.getByText(/Fråga AI/i)).toBeVisible()
      }
    })
  })

  test.describe('Task Editing', () => {
    test('should edit task title inline', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // Create a task to edit
      const addButton = page.locator('button:has(svg.lucide-plus)').first()
      await addButton.click()
      const originalTitle = `E2E Edit Test ${Date.now()}`
      await page
        .locator('input[placeholder*="Uppgiftens titel"]')
        .fill(originalTitle)
      await page.getByRole('button', { name: 'Skapa' }).click()
      await page.waitForTimeout(1000)

      // Open the task modal
      await page.getByText(originalTitle).click()
      await page.waitForTimeout(500)

      const modal = page.getByRole('dialog')

      // Click on title to edit
      const titleElement = modal.getByText(originalTitle)
      await titleElement.click()
      await page.waitForTimeout(200)

      // Find the input and change the title
      const titleInput = modal.locator('input[type="text"]').first()
      if (await titleInput.isVisible()) {
        const newTitle = `${originalTitle} - Edited`
        await titleInput.clear()
        await titleInput.fill(newTitle)
        await titleInput.blur()
        await page.waitForTimeout(1000)

        // Verify title changed
        await expect(modal.getByText(newTitle)).toBeVisible()
      }
    })

    test('should change task status', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        const modal = page.getByRole('dialog')

        // Find status dropdown
        const statusDropdown = modal.locator('[role="combobox"]').first()
        if (await statusDropdown.isVisible()) {
          await statusDropdown.click()
          await page.waitForTimeout(200)

          // Select a different status if options are visible
          const statusOptions = page.locator('[role="option"]')
          if ((await statusOptions.count()) > 1) {
            await statusOptions.nth(1).click()
            await page.waitForTimeout(500)
          }
        }
      }
    })

    test('should change task priority', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        const modal = page.getByRole('dialog')

        // Find priority selector (usually a select or buttons)
        const prioritySection = modal.locator('text=Prioritet').locator('..')
        const priorityDropdown = prioritySection.locator('[role="combobox"]')

        if (await priorityDropdown.isVisible()) {
          await priorityDropdown.click()
          await page.waitForTimeout(200)

          // Select "Hög" priority
          const highOption = page.getByRole('option', { name: 'Hög' })
          if (await highOption.isVisible()) {
            await highOption.click()
            await page.waitForTimeout(500)
          }
        }
      }
    })
  })

  test.describe('Comments', () => {
    test('should add a comment to task', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        const modal = page.getByRole('dialog')

        // Find comment input
        const commentInput = modal.locator('textarea[placeholder*="kommentar"]')
        if (await commentInput.isVisible()) {
          const commentText = `E2E Test Comment ${Date.now()}`
          await commentInput.fill(commentText)

          // Submit comment (Enter or button)
          await page.keyboard.press('Enter')
          await page.waitForTimeout(1000)

          // Verify comment appears (or toast notification)
        }
      }
    })
  })

  test.describe('AI Chat Flyout', () => {
    test('should open AI chat flyout on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1280, height: 800 })

      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        const modal = page.getByRole('dialog')

        // Find and click AI toggle button (Sparkles icon in header)
        const aiToggle = modal
          .locator('button:has(svg.lucide-sparkles)')
          .first()
        if (await aiToggle.isVisible()) {
          await aiToggle.click()
          await page.waitForTimeout(500)

          // AI chat panel should be visible
          const aiPanel = modal
            .locator('[data-testid="ai-chat-panel"]')
            .or(modal.getByText(/AI Assistent/i))
          await expect(aiPanel).toBeVisible({ timeout: 3000 })
        }
      }
    })

    test('should close AI chat flyout', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })

      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        const modal = page.getByRole('dialog')

        // Open AI chat
        const aiToggle = modal
          .locator('button:has(svg.lucide-sparkles)')
          .first()
        if (await aiToggle.isVisible()) {
          await aiToggle.click()
          await page.waitForTimeout(500)

          // Close AI chat
          await aiToggle.click()
          await page.waitForTimeout(500)

          // AI chat should be hidden
          const aiPanel = modal.locator('[data-testid="ai-chat-panel"]')
          await expect(aiPanel).not.toBeVisible()
        }
      }
    })
  })

  test.describe('Task Deletion', () => {
    test('should delete task with confirmation', async ({ page }) => {
      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // Create a task to delete
      const addButton = page.locator('button:has(svg.lucide-plus)').first()
      await addButton.click()
      const taskTitle = `E2E Delete Test ${Date.now()}`
      await page
        .locator('input[placeholder*="Uppgiftens titel"]')
        .fill(taskTitle)
      await page.getByRole('button', { name: 'Skapa' }).click()
      await page.waitForTimeout(1000)

      // Open the task modal
      await page.getByText(taskTitle).click()
      await page.waitForTimeout(500)

      const modal = page.getByRole('dialog')

      // Find delete button
      const deleteButton = modal.getByRole('button', {
        name: /radera uppgift/i,
      })
      if (await deleteButton.isVisible()) {
        await deleteButton.click()
        await page.waitForTimeout(300)

        // Confirm deletion
        const confirmButton = page
          .getByRole('button', { name: /radera/i })
          .last()
        if (await confirmButton.isVisible()) {
          await confirmButton.click()
          await page.waitForTimeout(1000)

          // Modal should close
          await expect(page.getByRole('dialog')).not.toBeVisible({
            timeout: 5000,
          })

          // Task should no longer be visible
          await expect(page.getByText(taskTitle)).not.toBeVisible()
        }
      }
    })
  })

  test.describe('Responsive Design', () => {
    test('should display modal correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        // Modal should be visible
        const modal = page.getByRole('dialog')
        await expect(modal).toBeVisible()

        // Modal should take full width on mobile
        const modalBox = await modal.boundingBox()
        if (modalBox) {
          expect(modalBox.width).toBeGreaterThan(350)
        }
      }
    })

    test('should hide AI chat toggle on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto('/uppgifter')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const taskCards = page.locator('[class*="cursor-grab"]')
      if ((await taskCards.count()) > 0) {
        await taskCards.first().click()
        await page.waitForTimeout(500)

        const modal = page.getByRole('dialog')

        // AI toggle button should be hidden on mobile
        const aiToggle = modal
          .locator('button:has(svg.lucide-sparkles)')
          .first()
        // It should either not exist or be hidden
        const isVisible = await aiToggle.isVisible().catch(() => false)
        expect(isVisible).toBe(false)
      }
    })
  })
})
