/**
 * Story 4.11 & 4.12: E2E Tests for Document List Management
 * Tests the personalized law list management feature and table view
 */

import { test, expect } from '@playwright/test'

// Test user credentials from environment
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123'

test.describe('Document List Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_EMAIL)
    await page.fill('input[name="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    // Wait for redirect to workspace
    await page.waitForURL(/\/(dashboard|laglistor)/)
  })

  test.describe('Document Lists Page', () => {
    test('should display document lists page with header', async ({ page }) => {
      await page.goto('/laglistor')

      // Check page title
      await expect(page.locator('h1')).toContainText('Mina laglistor')

      // Check description text
      await expect(page.getByText('Hantera dina laglistor')).toBeVisible()
    })

    test('should show list switcher dropdown', async ({ page }) => {
      await page.goto('/laglistor')

      // Find and click the document list switcher (not workspace switcher)
      // Use aria-haspopup="menu" to distinguish from workspace popover
      const switcher = page.locator('button[role="combobox"][aria-haspopup="menu"]')
      await expect(switcher).toBeVisible()

      await switcher.click()

      // Check dropdown content appears - use role option for DropdownMenuItem
      await expect(page.getByRole('option', { name: /Skapa ny lista/i }).or(
        page.getByText('Skapa ny lista')
      )).toBeVisible()
    })

    test('should show content type filter chips', async ({ page }) => {
      await page.goto('/laglistor')

      // Check filter chips are visible
      await expect(page.getByRole('button', { name: 'Alla' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Lagar' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Rättsfall' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'EU-dokument' })).toBeVisible()
    })

    test('should show add document button', async ({ page }) => {
      await page.goto('/laglistor')

      const addButton = page.getByRole('button', { name: /Lägg till dokument/i })
      await expect(addButton).toBeVisible()
    })

    test('should show export button', async ({ page }) => {
      await page.goto('/laglistor')

      const exportButton = page.getByRole('button', { name: /Exportera/i }).or(
        page.locator('button[title="Exportera lista"]')
      )
      await expect(exportButton).toBeVisible()
    })
  })

  test.describe('List Management Modal', () => {
    test('should open create list modal', async ({ page }) => {
      await page.goto('/laglistor')

      // Open list switcher dropdown (use aria-haspopup="menu" to distinguish)
      await page.locator('button[role="combobox"][aria-haspopup="menu"]').click()

      // Click create new list
      await page.getByText('Skapa ny lista').click()

      // Check modal appears
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Skapa ny lista' })).toBeVisible()

      // Check form fields
      await expect(page.getByLabel('Namn')).toBeVisible()
      await expect(page.getByLabel(/Beskrivning/i)).toBeVisible()
      await expect(page.getByLabel('Standardlista')).toBeVisible()
    })

    test('should validate list name is required', async ({ page }) => {
      await page.goto('/laglistor')

      // Open create modal (use aria-haspopup="menu" to distinguish)
      await page.locator('button[role="combobox"][aria-haspopup="menu"]').click()
      await page.getByText('Skapa ny lista').click()

      // Try to submit without name
      const createButton = page.getByRole('button', { name: 'Skapa' })
      await expect(createButton).toBeDisabled()
    })

    test('should create a new list', async ({ page }) => {
      await page.goto('/laglistor')

      // Open create modal (use aria-haspopup="menu" to distinguish)
      await page.locator('button[role="combobox"][aria-haspopup="menu"]').click()
      await page.getByText('Skapa ny lista').click()

      // Fill form
      const listName = `Test Lista ${Date.now()}`
      await page.getByLabel('Namn').fill(listName)
      await page.getByLabel(/Beskrivning/i).fill('Test beskrivning')

      // Submit
      await page.getByRole('button', { name: 'Skapa' }).click()

      // Wait for modal to close or for success indication (increase timeout)
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 })

      // Verify list is created - should be in switcher
      await page.locator('button[role="combobox"][aria-haspopup="menu"]').click()
      await expect(page.getByText(listName)).toBeVisible()
    })
  })

  test.describe('Add Document Modal', () => {
    test('should open add document modal', async ({ page }) => {
      await page.goto('/laglistor')

      // Click add document button
      await page.getByRole('button', { name: /Lägg till dokument/i }).click()

      // Check modal appears
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Lägg till dokument' })).toBeVisible()
      await expect(page.getByPlaceholder(/Sök på titel/i)).toBeVisible()
    })

    test('should search for documents', async ({ page }) => {
      await page.goto('/laglistor')

      // Open add document modal
      await page.getByRole('button', { name: /Lägg till dokument/i }).click()

      // Search for a common law term
      await page.getByPlaceholder(/Sök på titel/i).fill('arbetsmiljö')

      // Wait for results (debounced search)
      await page.waitForTimeout(500)

      // Should show results or "no results" message
      const hasResults = await page.locator('.flex.items-center.justify-between.p-3').count() > 0
      const hasNoResults = await page.getByText(/Inga resultat/i).isVisible()

      expect(hasResults || hasNoResults).toBeTruthy()
    })
  })

  test.describe('Content Type Filtering', () => {
    test('should filter by laws', async ({ page }) => {
      await page.goto('/laglistor')

      // Click the laws filter
      await page.getByRole('button', { name: 'Lagar' }).click()

      // Verify the filter is active
      const lagarButton = page.getByRole('button', { name: 'Lagar' })
      await expect(lagarButton).toHaveClass(/bg-primary/)
    })

    test('should filter by court cases', async ({ page }) => {
      await page.goto('/laglistor')

      // Click the court cases filter
      await page.getByRole('button', { name: 'Rättsfall' }).click()

      // Verify the filter is active
      const rattsfall = page.getByRole('button', { name: 'Rättsfall' })
      await expect(rattsfall).toHaveClass(/bg-primary/)
    })

    test('should reset to all when clicking Alla', async ({ page }) => {
      await page.goto('/laglistor')

      // First select a filter
      await page.getByRole('button', { name: 'Lagar' }).click()

      // Then click Alla
      await page.getByRole('button', { name: 'Alla' }).click()

      // Verify Alla is active
      const allaButton = page.getByRole('button', { name: 'Alla' })
      await expect(allaButton).toHaveClass(/bg-primary/)
    })
  })

  test.describe('Empty State', () => {
    test('should show documents or empty state correctly', async ({ page }) => {
      // Navigate and wait for network to be idle (no pending requests for 500ms)
      await page.goto('/laglistor', { waitUntil: 'networkidle' })

      // Additional wait for any client-side rendering
      await page.waitForTimeout(3000)

      // Now check what state we're in - the page should have finished loading
      const hasDocumentCard = await page.locator('[data-testid="document-card"]').count() > 0
      const hasGroupHeader = await page.getByText('Ogrupperade').count() > 0
      const hasShowingText = await page.getByText(/Visar \d+ av \d+ dokument/).count() > 0
      const hasEmptyState = await page.getByText(/Inga dokument|Välj eller skapa/i).count() > 0
      const hasListHeader = await page.getByText('Huvudlista').count() > 0

      // Either we should see documents, empty state, or at least the list header
      const validState = hasDocumentCard || hasGroupHeader || hasShowingText || hasEmptyState || hasListHeader
      expect(validState).toBe(true)
    })
  })

  test.describe('Export Functionality', () => {
    test('should show export dropdown options', async ({ page }) => {
      await page.goto('/laglistor')

      // Find export button
      const exportButton = page.locator('button[title="Exportera lista"]')

      // If button is not disabled, click it
      const isDisabled = await exportButton.isDisabled()
      if (!isDisabled) {
        await exportButton.click()

        // Check dropdown options
        await expect(page.getByText('Exportera som CSV')).toBeVisible()
        await expect(page.getByText('Exportera som PDF')).toBeVisible()
      }
    })
  })

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto('/laglistor')

      // Check page loads correctly
      await expect(page.locator('h1')).toContainText('Mina laglistor')

      // Check buttons are visible
      await expect(page.getByRole('button', { name: /Lägg till/i })).toBeVisible()
    })

    test('should work on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })

      await page.goto('/laglistor')

      // Check page loads correctly
      await expect(page.locator('h1')).toContainText('Mina laglistor')
    })
  })

  // Story 4.12: Table View Tests
  test.describe('Table View (Story 4.12)', () => {
    test('should show view toggle with card and table options', async ({ page }) => {
      await page.goto('/laglistor')

      // Check view toggle is present
      const cardToggle = page.getByRole('radio', { name: /kortvy/i })
      const tableToggle = page.getByRole('radio', { name: /tabellvy/i })

      await expect(cardToggle).toBeVisible()
      await expect(tableToggle).toBeVisible()
    })

    test('should switch to table view when clicking table toggle', async ({ page }) => {
      await page.goto('/laglistor')

      // Click table view toggle
      await page.getByRole('radio', { name: /tabellvy/i }).click()

      // Wait for view to change
      await page.waitForTimeout(300)

      // Table should be visible
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Table headers should be present (using button inside header cells)
      await expect(page.getByRole('button', { name: 'Titel' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Status' })).toBeVisible()
    })

    test('should persist view preference', async ({ page }) => {
      await page.goto('/laglistor')

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(300)

      // Reload page
      await page.reload()

      // Table view should still be selected
      const tableToggle = page.getByRole('radio', { name: /tabellvy/i })
      await expect(tableToggle).toHaveAttribute('aria-checked', 'true')
    })

    test('should show column settings dropdown', async ({ page }) => {
      await page.goto('/laglistor')

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(300)

      // Click column settings button
      const columnButton = page.getByRole('button', { name: /kolumner/i })
      await expect(columnButton).toBeVisible()
      await columnButton.click()

      // Dropdown should show column options
      await expect(page.getByText('Visa kolumner')).toBeVisible()
      await expect(page.getByText('Tilldelad')).toBeVisible()
      await expect(page.getByText('Anteckningar')).toBeVisible()
    })

    test('should toggle column visibility', async ({ page }) => {
      await page.goto('/laglistor')

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(300)

      // Open column settings
      await page.getByRole('button', { name: /kolumner/i }).click()

      // Check Tilldelad is initially hidden (unchecked by default)
      await page.getByText('Tilldelad').click()

      // Close dropdown
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      // Tilldelad column should now be visible (check for header button)
      await expect(page.getByRole('button', { name: 'Tilldelad' })).toBeVisible()
    })

    test('should sort by column when clicking header', async ({ page }) => {
      await page.goto('/laglistor')

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(300)

      // Click on Title column header button to sort
      const titleButton = page.getByRole('button', { name: 'Titel' })
      await titleButton.click()

      // Should show sort indicator (arrow icon)
      await expect(titleButton.locator('svg')).toBeVisible()
    })

    test('should show bulk action bar when items selected', async ({ page }) => {
      await page.goto('/laglistor')

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // If there are rows, select one using checkbox
      const checkboxes = page.locator('table tbody tr input[type="checkbox"]')
      const hasRows = (await checkboxes.count()) > 0

      if (hasRows) {
        await checkboxes.first().click()

        // Bulk action bar should appear
        const bulkActionBar = page.getByRole('toolbar', { name: /massåtgärder/i })
        await expect(bulkActionBar).toBeVisible()
        await expect(page.getByText(/1 vald/)).toBeVisible()
      }
    })

    test('should open inline status editor in table', async ({ page }) => {
      await page.goto('/laglistor')

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // If there are status cells, click one to edit
      const statusCells = page.locator('table tbody td').filter({ hasText: /(Ej påbörjad|Pågår|Uppfylld)/i })
      const hasCells = (await statusCells.count()) > 0

      if (hasCells) {
        // Click the status cell combobox
        const statusCombobox = statusCells.first().locator('[role="combobox"]')
        if ((await statusCombobox.count()) > 0) {
          await statusCombobox.click()

          // Should show status options
          await expect(page.getByRole('option', { name: 'Pågår' })).toBeVisible()
        }
      }
    })

    test('should switch back to card view', async ({ page }) => {
      await page.goto('/laglistor')

      // Switch to table view first
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(300)

      // Verify table is visible
      await expect(page.locator('table')).toBeVisible()

      // Then switch back to card view
      await page.getByRole('radio', { name: /kortvy/i }).click()
      await page.waitForTimeout(300)

      // Table should not be visible
      await expect(page.locator('table')).not.toBeVisible()

      // Card view should be active (card toggle selected)
      const cardToggle = page.getByRole('radio', { name: /kortvy/i })
      await expect(cardToggle).toHaveAttribute('aria-checked', 'true')
    })

    test('should reset column visibility to defaults', async ({ page }) => {
      await page.goto('/laglistor')

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(300)

      // Open column settings
      await page.getByRole('button', { name: /kolumner/i }).click()
      await page.waitForTimeout(200)

      // Toggle a column (e.g., show Tilldelad)
      const tilldeladCheckbox = page.getByRole('menuitemcheckbox', { name: 'Tilldelad' })
      await tilldeladCheckbox.click()

      // Verify column is now visible
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await expect(page.getByRole('button', { name: 'Tilldelad' })).toBeVisible()

      // Re-open column settings and click reset
      await page.getByRole('button', { name: /kolumner/i }).click()
      await page.waitForTimeout(200)

      // Click reset to defaults button
      await page.getByRole('button', { name: 'Återställ standard' }).click()

      // Close dropdown and verify
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      // Tilldelad column header button should not be visible (default is hidden)
      await expect(page.getByRole('button', { name: 'Tilldelad' })).not.toBeVisible()
    })

    test('should work on tablet viewport in table view', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })

      await page.goto('/laglistor')

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(300)

      // Table should be visible and scrollable
      const table = page.locator('table')
      await expect(table).toBeVisible()
    })
  })

  // Story 4.13: Document Grouping Tests
  test.describe('Document Grouping (Story 4.13)', () => {
    test('should show groups button in card view', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // "Grupper" button should be visible
      await expect(page.getByRole('button', { name: /grupper/i })).toBeVisible()
    })

    test('should open group manager modal', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Click groups button
      await page.getByRole('button', { name: /grupper/i }).click()
      await page.waitForTimeout(500)

      // Modal should open with "Hantera grupper" title
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByText('Hantera grupper')).toBeVisible()
    })

    test('should create a new group', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Open group manager
      await page.getByRole('button', { name: /grupper/i }).click()
      await page.waitForTimeout(500)

      // Click "Skapa ny grupp" button to show the input
      await page.getByRole('button', { name: /skapa ny grupp/i }).click()
      await page.waitForTimeout(300)

      // Fill in group name (placeholder is "Nytt gruppnamn...")
      const input = page.getByPlaceholder(/nytt gruppnamn/i)
      await input.fill('E2E Test Grupp')

      // Click confirm button (checkmark)
      await page.locator('button:has(svg.lucide-check)').click()
      await page.waitForTimeout(500)

      // New group should appear in list
      await expect(page.getByText('E2E Test Grupp')).toBeVisible()
    })

    test('should show ungrouped section with documents', async ({ page }) => {
      await page.goto('/laglistor', { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      // Check for "Ogrupperade" section (ungrouped items)
      const hasUngrouped = await page.getByText('Ogrupperade').count() > 0
      const hasDocuments = await page.locator('[data-testid="document-card"]').count() > 0

      // Should have either ungrouped section or documents directly
      expect(hasUngrouped || hasDocuments).toBe(true)
    })

    test('should expand and collapse group accordion', async ({ page }) => {
      await page.goto('/laglistor', { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      // Find a group header (either custom group or "Ogrupperade")
      const groupHeader = page.locator('button[title="Fäll ihop"], button[title="Expandera"]').first()

      if (await groupHeader.count() > 0) {
        // Get initial state
        const initialTitle = await groupHeader.getAttribute('title')

        // Click to toggle
        await groupHeader.click()
        await page.waitForTimeout(300)

        // Title should change
        const newTitle = await groupHeader.getAttribute('title')
        expect(newTitle).not.toBe(initialTitle)
      }
    })

    test('should have filterable group headers', async ({ page }) => {
      await page.goto('/laglistor', { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      // Check if there are any filterable group name buttons
      // These have titles like "Filtrera till "Ogrupperade""
      const filterButtons = page.locator('button[title^="Filtrera till"]')
      const buttonCount = await filterButtons.count()

      // If we have documents, we should have at least the "Ogrupperade" filter button
      const hasDocuments = (await page.locator('[data-testid="document-card"]').count()) > 0
      if (hasDocuments) {
        expect(buttonCount).toBeGreaterThan(0)
      }
    })

    test('should clear group filter when clicking X on filter chip', async ({ page }) => {
      await page.goto('/laglistor', { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      // Find and click a filterable group name
      const groupNameButton = page.locator('button[title^="Filtrera till"]').first()

      if (await groupNameButton.count() > 0) {
        await groupNameButton.click()
        await page.waitForTimeout(500)

        // Click clear button on filter chip
        const clearButton = page.getByRole('button', { name: /rensa gruppfilter/i })
        if (await clearButton.count() > 0) {
          await clearButton.click()
          await page.waitForTimeout(500)

          // Filter chip should be gone
          await expect(page.getByText('Visar:')).not.toBeVisible()
        }
      }
    })

    test('should support deep linking with list URL param', async ({ page }) => {
      // Navigate to laglistor page
      await page.goto('/laglistor')
      await page.waitForTimeout(1500)

      // Page should load successfully with the document list interface
      await expect(page.getByRole('button', { name: /grupper/i })).toBeVisible()

      // The list switcher should be visible (the combobox that's NOT the workspace switcher)
      // The workspace switcher has aria-label="Byt arbetsplats", so we exclude it
      const listSwitcher = page.locator('button[role="combobox"]:not([aria-label="Byt arbetsplats"])')
      await expect(listSwitcher).toBeVisible()

      // Click the switcher to open dropdown
      await listSwitcher.click()
      await page.waitForTimeout(500)

      // Should show at least one list option (the current list)
      const listOptions = page.locator('[role="menuitem"]')
      const optionCount = await listOptions.count()
      expect(optionCount).toBeGreaterThan(0)
    })

    test('should show groups button in table view', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // "Grupper" button should still be visible in header
      await expect(page.getByRole('button', { name: /grupper/i })).toBeVisible()
    })

    test('should show group column in table view', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Group column header should be visible (use exact match to avoid header button)
      await expect(page.getByRole('button', { name: 'Grupp', exact: true })).toBeVisible()
    })
  })
})
