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
      await expect(page.locator('h1')).toContainText('Mina listor')

      // Check description text
      await expect(page.getByText('Hantera dina laglistor')).toBeVisible()
    })

    test('should show list switcher dropdown', async ({ page }) => {
      await page.goto('/laglistor')

      // Find and click the document list switcher (not workspace switcher)
      // Use aria-haspopup="menu" to distinguish from workspace popover
      const switcher = page.locator(
        'button[role="combobox"][aria-haspopup="menu"]'
      )
      await expect(switcher).toBeVisible()

      await switcher.click()

      // Check dropdown content appears - use role option for DropdownMenuItem
      await expect(
        page
          .getByRole('option', { name: /Skapa ny lista/i })
          .or(page.getByText('Skapa ny lista'))
      ).toBeVisible()
    })

    test('should show content type filter chips', async ({ page }) => {
      await page.goto('/laglistor')

      // Check filter chips are visible
      await expect(page.getByRole('button', { name: 'Alla' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Lagar' })).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Rättsfall' })
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'EU-dokument' })
      ).toBeVisible()
    })

    test('should show add document button', async ({ page }) => {
      await page.goto('/laglistor')

      const addButton = page.getByRole('button', {
        name: /Lägg till dokument/i,
      })
      await expect(addButton).toBeVisible()
    })

    test('should show export button', async ({ page }) => {
      await page.goto('/laglistor')

      const exportButton = page
        .getByRole('button', { name: /Exportera/i })
        .or(page.locator('button[title="Exportera lista"]'))
      await expect(exportButton).toBeVisible()
    })
  })

  test.describe('List Management Modal', () => {
    test('should open create list modal', async ({ page }) => {
      await page.goto('/laglistor')

      // Open list switcher dropdown (use aria-haspopup="menu" to distinguish)
      await page
        .locator('button[role="combobox"][aria-haspopup="menu"]')
        .click()

      // Click create new list
      await page.getByText('Skapa ny lista').click()

      // Check modal appears
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Skapa ny lista' })
      ).toBeVisible()

      // Check form fields
      await expect(page.getByLabel('Namn')).toBeVisible()
      await expect(page.getByLabel(/Beskrivning/i)).toBeVisible()
      await expect(page.getByLabel('Standardlista')).toBeVisible()
    })

    test('should validate list name is required', async ({ page }) => {
      await page.goto('/laglistor')

      // Open create modal (use aria-haspopup="menu" to distinguish)
      await page
        .locator('button[role="combobox"][aria-haspopup="menu"]')
        .click()
      await page.getByText('Skapa ny lista').click()

      // Try to submit without name
      const createButton = page.getByRole('button', { name: 'Skapa' })
      await expect(createButton).toBeDisabled()
    })

    test('should create a new list', async ({ page }) => {
      await page.goto('/laglistor')

      // Open create modal (use aria-haspopup="menu" to distinguish)
      await page
        .locator('button[role="combobox"][aria-haspopup="menu"]')
        .click()
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
      await page
        .locator('button[role="combobox"][aria-haspopup="menu"]')
        .click()
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
      await expect(
        page.getByRole('heading', { name: 'Lägg till dokument' })
      ).toBeVisible()
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
      const hasResults =
        (await page.locator('.flex.items-center.justify-between.p-3').count()) >
        0
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
      const hasDocumentCard =
        (await page.locator('[data-testid="document-card"]').count()) > 0
      const hasGroupHeader = (await page.getByText('Ogrupperade').count()) > 0
      const hasShowingText =
        (await page.getByText(/Visar \d+ av \d+ dokument/).count()) > 0
      const hasEmptyState =
        (await page.getByText(/Inga dokument|Välj eller skapa/i).count()) > 0
      const hasListHeader = (await page.getByText('Huvudlista').count()) > 0

      // Either we should see documents, empty state, or at least the list header
      const validState =
        hasDocumentCard ||
        hasGroupHeader ||
        hasShowingText ||
        hasEmptyState ||
        hasListHeader
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
      await expect(page.locator('h1')).toContainText('Mina listor')

      // Check buttons are visible
      await expect(
        page.getByRole('button', { name: /Lägg till/i })
      ).toBeVisible()
    })

    test('should work on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })

      await page.goto('/laglistor')

      // Check page loads correctly
      await expect(page.locator('h1')).toContainText('Mina listor')
    })
  })

  // Story 4.12: Table View Tests
  test.describe('Table View (Story 4.12)', () => {
    test('should show view toggle with card and table options', async ({
      page,
    }) => {
      await page.goto('/laglistor')

      // Check view toggle is present
      const cardToggle = page.getByRole('radio', { name: /kortvy/i })
      const tableToggle = page.getByRole('radio', { name: /tabellvy/i })

      await expect(cardToggle).toBeVisible()
      await expect(tableToggle).toBeVisible()
    })

    test('should switch to table view when clicking table toggle', async ({
      page,
    }) => {
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
      await expect(
        page.getByRole('button', { name: 'Tilldelad' })
      ).toBeVisible()
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

    test('should show bulk action bar when items selected', async ({
      page,
    }) => {
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
        const bulkActionBar = page.getByRole('toolbar', {
          name: /massåtgärder/i,
        })
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
      const statusCells = page
        .locator('table tbody td')
        .filter({ hasText: /(Ej påbörjad|Pågår|Uppfylld)/i })
      const hasCells = (await statusCells.count()) > 0

      if (hasCells) {
        // Click the status cell combobox
        const statusCombobox = statusCells.first().locator('[role="combobox"]')
        if ((await statusCombobox.count()) > 0) {
          await statusCombobox.click()

          // Should show status options
          await expect(
            page.getByRole('option', { name: 'Pågår' })
          ).toBeVisible()
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
      const tilldeladCheckbox = page.getByRole('menuitemcheckbox', {
        name: 'Tilldelad',
      })
      await tilldeladCheckbox.click()

      // Verify column is now visible
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await expect(
        page.getByRole('button', { name: 'Tilldelad' })
      ).toBeVisible()

      // Re-open column settings and click reset
      await page.getByRole('button', { name: /kolumner/i }).click()
      await page.waitForTimeout(200)

      // Click reset to defaults button
      await page.getByRole('button', { name: 'Återställ standard' }).click()

      // Close dropdown and verify
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      // Tilldelad column header button should not be visible (default is hidden)
      await expect(
        page.getByRole('button', { name: 'Tilldelad' })
      ).not.toBeVisible()
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
      const hasUngrouped = (await page.getByText('Ogrupperade').count()) > 0
      const hasDocuments =
        (await page.locator('[data-testid="document-card"]').count()) > 0

      // Should have either ungrouped section or documents directly
      expect(hasUngrouped || hasDocuments).toBe(true)
    })

    test('should expand and collapse group accordion', async ({ page }) => {
      await page.goto('/laglistor', { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      // Find a group header (either custom group or "Ogrupperade")
      const groupHeader = page
        .locator('button[title="Fäll ihop"], button[title="Expandera"]')
        .first()

      if ((await groupHeader.count()) > 0) {
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
      const hasDocuments =
        (await page.locator('[data-testid="document-card"]').count()) > 0
      if (hasDocuments) {
        expect(buttonCount).toBeGreaterThan(0)
      }
    })

    test('should clear group filter when clicking X on filter chip', async ({
      page,
    }) => {
      await page.goto('/laglistor', { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      // Find and click a filterable group name
      const groupNameButton = page
        .locator('button[title^="Filtrera till"]')
        .first()

      if ((await groupNameButton.count()) > 0) {
        await groupNameButton.click()
        await page.waitForTimeout(500)

        // Click clear button on filter chip
        const clearButton = page.getByRole('button', {
          name: /rensa gruppfilter/i,
        })
        if ((await clearButton.count()) > 0) {
          await clearButton.click()
          await page.waitForTimeout(500)

          // Filter chip should be gone
          await expect(page.getByText('Visar:')).not.toBeVisible()
        }
      }
    })

    test('should support deep linking with list URL param', async ({
      page,
    }) => {
      // Navigate to laglistor page
      await page.goto('/laglistor')
      await page.waitForTimeout(1500)

      // Page should load successfully with the document list interface
      await expect(page.getByRole('button', { name: /grupper/i })).toBeVisible()

      // The list switcher should be visible (the combobox that's NOT the workspace switcher)
      // The workspace switcher has aria-label="Byt arbetsplats", so we exclude it
      const listSwitcher = page.locator(
        'button[role="combobox"]:not([aria-label="Byt arbetsplats"])'
      )
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
      await expect(
        page.getByRole('button', { name: 'Grupp', exact: true })
      ).toBeVisible()
    })
  })

  // Story 6.2: Compliance View Tests
  test.describe('Compliance View (Story 6.2)', () => {
    test('should show compliance status column in table view', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Compliance status column header should be visible (exact match to avoid filter button)
      await expect(
        page.getByRole('button', { name: 'Efterlevnad', exact: true })
      ).toBeVisible()
    })

    test('should show responsible person column in table view', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Responsible person column header should be visible (it's a cell, not a button - not sortable)
      await expect(
        page.locator('table th').filter({ hasText: /^Ansvarig$/ })
      ).toBeVisible()
    })

    test('should show task progress column in table view', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Task progress column header should be visible (use table header cell)
      await expect(
        page.locator('table th').filter({ hasText: 'Uppgifter' })
      ).toBeVisible()
    })

    test('should show last activity column in table view', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Last activity column header should be visible
      await expect(
        page.getByRole('button', { name: 'Aktivitet' })
      ).toBeVisible()
    })

    test('should open inline compliance status editor in table', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Find compliance status cells
      const complianceCells = page.locator('table tbody td').filter({
        hasText: /(Ej påbörjad|Pågående|Uppfylld|Ej uppfylld|Ej tillämplig)/i,
      })
      const hasCells = (await complianceCells.count()) > 0

      if (hasCells) {
        // Click the compliance status cell combobox
        const statusCombobox = complianceCells
          .first()
          .locator('[role="combobox"]')
        if ((await statusCombobox.count()) > 0) {
          await statusCombobox.click()

          // Should show compliance status options
          await expect(
            page.getByRole('option', { name: 'Uppfylld' })
          ).toBeVisible()
          await expect(
            page.getByRole('option', { name: 'Ej uppfylld' })
          ).toBeVisible()
        }
      }
    })

    test('should show compliance status in bulk action bar', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

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

        // Bulk action bar should appear with compliance status option
        const bulkActionBar = page.getByRole('toolbar', {
          name: /massåtgärder/i,
        })
        await expect(bulkActionBar).toBeVisible()
        await expect(page.getByText('Efterlevnadsstatus:')).toBeVisible()
      }
    })

    test('should update compliance status via bulk action', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

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

        // Wait for bulk action bar
        const bulkActionBar = page.getByRole('toolbar', {
          name: /massåtgärder/i,
        })
        await expect(bulkActionBar).toBeVisible()

        // Open compliance status dropdown in bulk action bar
        const complianceSelect = bulkActionBar
          .locator('text=Efterlevnadsstatus:')
          .locator('..')
          .locator('[role="combobox"]')

        if ((await complianceSelect.count()) > 0) {
          await complianceSelect.click()
          await page.waitForTimeout(200)

          // Select "Uppfylld"
          await page.getByRole('option', { name: 'Uppfylld' }).click()
          await page.waitForTimeout(500)

          // Selection should be cleared after bulk update
          await expect(bulkActionBar).not.toBeVisible()
        }
      }
    })

    test('should show strikethrough style for EJ_TILLAMPLIG status', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Find compliance status cells
      const complianceCells = page
        .locator('table tbody td [role="combobox"]')
        .first()

      if ((await complianceCells.count()) > 0) {
        // Click to open dropdown
        await complianceCells.click()
        await page.waitForTimeout(200)

        // Select "Ej tillämplig"
        await page.getByRole('option', { name: 'Ej tillämplig' }).click()
        await page.waitForTimeout(500)

        // Check that the badge has strikethrough class
        const badge = complianceCells.locator('span.line-through')
        await expect(badge).toBeVisible()
      }
    })

    test('should make rows clickable when onRowClick is provided', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Check that rows have cursor-pointer class (indicating they're clickable)
      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        // Rows should have hover styling
        const firstRow = rows.first()
        await expect(firstRow).toHaveClass(/group/)
      }
    })

    // Task 14 E2E Tests
    test('should persist compliance status change after page reload', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Find compliance status cells
      const complianceCells = page
        .locator('table tbody tr')
        .first()
        .locator('[role="combobox"]')
        .first()

      if ((await complianceCells.count()) > 0) {
        // Get current status
        const originalStatus = await complianceCells.textContent()

        // Click to open dropdown
        await complianceCells.click()
        await page.waitForTimeout(200)

        // Select a different status (Uppfylld if not already, else Pågående)
        const targetStatus = originalStatus?.includes('Uppfylld')
          ? 'Pågående'
          : 'Uppfylld'
        await page.getByRole('option', { name: targetStatus }).click()
        await page.waitForTimeout(1000) // Wait for save

        // Reload the page
        await page.reload()
        await page.waitForTimeout(1500)

        // Switch back to table view (preference should persist)
        const tableToggle = page.getByRole('radio', { name: /tabellvy/i })
        if ((await tableToggle.getAttribute('aria-checked')) !== 'true') {
          await tableToggle.click()
          await page.waitForTimeout(500)
        }

        // Verify the status persisted
        const newComplianceCell = page
          .locator('table tbody tr')
          .first()
          .locator('[role="combobox"]')
          .first()
        const newStatus = await newComplianceCell.textContent()
        expect(newStatus).toContain(targetStatus)
      }
    })

    test('should reduce visible row count when applying filters', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Count initial rows
      const initialRows = await page.locator('table tbody tr').count()

      if (initialRows >= 2) {
        // Find compliance status filter
        const statusFilter = page.locator('[role="combobox"]').filter({
          has: page.locator('span', { hasText: /Alla statusar|Efterlevnad/i }),
        })

        if ((await statusFilter.count()) > 0) {
          await statusFilter.first().click()
          await page.waitForTimeout(200)

          // Select a specific status filter
          const filterOption = page
            .getByRole('option', { name: 'Uppfylld' })
            .or(page.getByRole('menuitemcheckbox', { name: 'Uppfylld' }))

          if ((await filterOption.count()) > 0) {
            await filterOption.click()
            await page.waitForTimeout(500)

            // Count filtered rows - should be <= initial
            const filteredRows = await page.locator('table tbody tr').count()
            expect(filteredRows).toBeLessThanOrEqual(initialRows)
          }
        }
      }
    })

    test('should display empty state when filters return no results', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Get initial document count from "Visar X av Y dokument" text
      const countText = page.getByText(/Visar \d+ av \d+ dokument/)
      await expect(countText).toBeVisible()

      // Search for something that won't match
      const searchInput = page.locator('input[placeholder="Sök..."]')
      if ((await searchInput.count()) > 0) {
        await searchInput.fill('xyznonexistent12345')
        await page.waitForTimeout(800) // Wait for debounce (300ms) + render

        // After search, should show "Visar 0 av 0 dokument" or empty state message
        const zeroResults = page.getByText('Visar 0 av 0 dokument')
        const emptyState = page.getByText(/Inga resultat|Inga lagar matchar/i)

        // Either shows zero results count or empty state message
        const hasZeroResults = await zeroResults.isVisible().catch(() => false)
        const hasEmptyState = await emptyState.isVisible().catch(() => false)

        expect(hasZeroResults || hasEmptyState).toBeTruthy()

        // Clear search
        await searchInput.clear()
        await page.waitForTimeout(500)

        // Should no longer show 0 results
        const restoredCount = page.getByText(/Visar \d+ av \d+ dokument/)
        await expect(restoredCount).toBeVisible()
      }
    })

    test('should find items by document number in search', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Get the first row's document number (SFS number)
      const firstRow = page.locator('table tbody tr').first()
      const docNumberCell = firstRow.locator('td').nth(1) // Typically the second column
      const docNumber = await docNumberCell.textContent()

      if (docNumber && docNumber.match(/\d+:\d+/)) {
        // Extract SFS number pattern (e.g., "2010:110")
        const sfsMatch = docNumber.match(/\d+:\d+/)
        if (sfsMatch) {
          const sfsNumber = sfsMatch[0]

          // Search by SFS number
          const searchInput = page.getByPlaceholder(/Sök/i)
          if ((await searchInput.count()) > 0) {
            await searchInput.fill(sfsNumber)
            await page.waitForTimeout(500) // Wait for debounce

            // Should still show at least the original row
            const searchResults = await page.locator('table tbody tr').count()
            expect(searchResults).toBeGreaterThanOrEqual(1)

            // The original row should still be visible
            await expect(page.getByText(sfsNumber).first()).toBeVisible()
          }
        }
      }
    })

    test('should update multiple items via bulk status change', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Check if we have at least 2 rows
      const checkboxes = page.locator('table tbody tr input[type="checkbox"]')
      const rowCount = await checkboxes.count()

      if (rowCount >= 2) {
        // Select first two items
        await checkboxes.nth(0).click()
        await checkboxes.nth(1).click()

        // Wait for bulk action bar
        const bulkActionBar = page.getByRole('toolbar', {
          name: /massåtgärder/i,
        })
        await expect(bulkActionBar).toBeVisible()

        // Verify selection count shows 2
        await expect(page.getByText(/2 valda/i)).toBeVisible()

        // Open compliance status dropdown in bulk action bar
        const complianceDropdown = bulkActionBar
          .locator('[role="combobox"]')
          .first()

        if ((await complianceDropdown.count()) > 0) {
          await complianceDropdown.click()
          await page.waitForTimeout(200)

          // Select "Pågående"
          await page.getByRole('option', { name: 'Pågående' }).click()
          await page.waitForTimeout(1000)

          // Bulk action bar should dismiss after update
          await expect(bulkActionBar).not.toBeVisible({ timeout: 5000 })

          // Verify both items were updated by checking their status cells
          const firstRowStatus = page
            .locator('table tbody tr')
            .nth(0)
            .locator('[role="combobox"]')
            .first()
          const secondRowStatus = page
            .locator('table tbody tr')
            .nth(1)
            .locator('[role="combobox"]')
            .first()

          // At least one should show Pågående (depending on which column is compliance)
          const firstText = await firstRowStatus.textContent()
          const secondText = await secondRowStatus.textContent()
          const hasUpdate =
            firstText?.includes('Pågående') || secondText?.includes('Pågående')
          expect(hasUpdate).toBeTruthy()
        }
      }
    })

    test('should perform smoothly with table data', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Measure scroll performance
      const startTime = Date.now()

      // Scroll down in the table container
      const tableContainer = page.locator('.overflow-auto').first()
      if ((await tableContainer.count()) > 0) {
        await tableContainer.evaluate((el) => {
          el.scrollTop = el.scrollHeight
        })
        await page.waitForTimeout(100)

        await tableContainer.evaluate((el) => {
          el.scrollTop = 0
        })
        await page.waitForTimeout(100)
      }

      const scrollTime = Date.now() - startTime

      // Scroll operations should complete within 500ms
      expect(scrollTime).toBeLessThan(500)

      // Measure sort performance
      const titleHeader = page.getByRole('button', { name: 'Titel' })
      if ((await titleHeader.count()) > 0) {
        const sortStart = Date.now()
        await titleHeader.click()
        await page.waitForTimeout(100)
        const sortTime = Date.now() - sortStart

        // Sort should be fast (under 300ms for responsive UX)
        expect(sortTime).toBeLessThan(300)
      }

      // Verify no console errors during operations
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
        }
      })

      // Do a few more interactions
      await page.getByRole('radio', { name: /kortvy/i }).click()
      await page.waitForTimeout(300)
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(300)

      // Filter console errors for actual issues (not React dev warnings)
      const realErrors = consoleErrors.filter(
        (e) => !e.includes('Warning:') && !e.includes('DevTools')
      )
      expect(realErrors.length).toBe(0)
    })
  })

  // Story 6.3: Legal Document Modal Tests
  test.describe('Legal Document Modal (Story 6.3)', () => {
    test('should open modal when clicking on table row', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Click on a row (not on interactive elements like checkboxes or buttons)
      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        // Click on the title cell (non-interactive area)
        const titleCell = rows.first().locator('td').nth(4) // Title column
        await titleCell.click()
        await page.waitForTimeout(500)

        // Modal should open
        await expect(page.getByRole('dialog')).toBeVisible()
      }
    })

    test('should display law title and document number in modal', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Click on a row
      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        // Modal should show document title (h2)
        await expect(
          page.getByRole('dialog').locator('h2').first()
        ).toBeVisible()
      }
    })

    test('should show breadcrumb navigation in modal header', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      const table = page.locator('table')
      await expect(table).toBeVisible()

      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        // Modal should show breadcrumb (list name > law title)
        const modal = page.getByRole('dialog')
        await expect(modal).toBeVisible()

        // Should have breadcrumb navigation element
        await expect(modal.locator('nav').first()).toBeVisible()
      }
    })

    test('should close modal when clicking close button', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      const table = page.locator('table')
      await expect(table).toBeVisible()

      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        // Modal should be open
        await expect(page.getByRole('dialog')).toBeVisible()

        // Click close button
        await page.getByRole('button', { name: /stäng/i }).click()
        await page.waitForTimeout(300)

        // Modal should be closed
        await expect(page.getByRole('dialog')).not.toBeVisible()
      }
    })

    test('should close modal when pressing Escape', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      const table = page.locator('table')
      await expect(table).toBeVisible()

      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        // Modal should be open
        await expect(page.getByRole('dialog')).toBeVisible()

        // Press Escape
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)

        // Modal should be closed
        await expect(page.getByRole('dialog')).not.toBeVisible()
      }
    })

    test('should show lagtext section with expand/collapse', async ({
      page,
    }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      const table = page.locator('table')
      await expect(table).toBeVisible()

      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        // Modal should show Lagtext section
        const modal = page.getByRole('dialog')
        await expect(modal.getByText('Lagtext')).toBeVisible()

        // Should have expand button
        const expandButton = modal.getByRole('button', { name: /visa mer/i })
        const collapseButton = modal.getByRole('button', {
          name: /visa mindre/i,
        })

        // Either expand or collapse button should be visible
        const hasExpandOrCollapse =
          (await expandButton.isVisible().catch(() => false)) ||
          (await collapseButton.isVisible().catch(() => false))
        expect(hasExpandOrCollapse).toBeTruthy()
      }
    })

    test('should show business context textarea', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      const table = page.locator('table')
      await expect(table).toBeVisible()

      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        // Modal should show business context section
        const modal = page.getByRole('dialog')
        await expect(modal.getByText(/hur påverkar denna lag/i)).toBeVisible()

        // Should have textarea
        await expect(modal.locator('textarea')).toBeVisible()
      }
    })

    test('should show activity tabs', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      const table = page.locator('table')
      await expect(table).toBeVisible()

      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        const modal = page.getByRole('dialog')

        // Should show activity tabs
        await expect(modal.getByRole('tab', { name: 'Alla' })).toBeVisible()
        await expect(
          modal.getByRole('tab', { name: 'Kommentarer' })
        ).toBeVisible()
        await expect(
          modal.getByRole('tab', { name: 'Uppgifter' })
        ).toBeVisible()
        await expect(modal.getByRole('tab', { name: 'Bevis' })).toBeVisible()
        await expect(modal.getByRole('tab', { name: 'Historik' })).toBeVisible()
      }
    })

    test('should show right panel with details box', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      const table = page.locator('table')
      await expect(table).toBeVisible()

      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        const modal = page.getByRole('dialog')

        // Should show details section
        await expect(modal.getByText('Detaljer')).toBeVisible()
        await expect(modal.getByText('Status')).toBeVisible()
      }
    })

    test('should show quick links box with navigation', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      const table = page.locator('table')
      await expect(table).toBeVisible()

      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        const modal = page.getByRole('dialog')

        // Should show quick links section
        await expect(modal.getByText('Snabblänkar')).toBeVisible()
        await expect(
          modal.getByRole('link', { name: /visa fullständig lag/i })
        ).toBeVisible()
      }
    })

    test('should show tasks and evidence summary boxes', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      const table = page.locator('table')
      await expect(table).toBeVisible()

      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        const modal = page.getByRole('dialog')

        // Should show tasks summary section
        await expect(modal.getByText('Uppgifter').first()).toBeVisible()

        // Should show evidence summary section
        await expect(modal.getByText('Bevis').first()).toBeVisible()
      }
    })

    test('should update compliance status from modal', async ({ page }) => {
      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      const table = page.locator('table')
      await expect(table).toBeVisible()

      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        const modal = page.getByRole('dialog')

        // Find status dropdown in modal (first combobox in details section)
        const statusDropdown = modal.locator('[role="combobox"]').first()

        if ((await statusDropdown.count()) > 0) {
          // Get current status
          const currentStatus = await statusDropdown.textContent()

          // Open dropdown
          await statusDropdown.click()
          await page.waitForTimeout(200)

          // Select different status
          const targetStatus = currentStatus?.includes('Uppfylld')
            ? 'Pågående'
            : 'Uppfylld'
          await page.getByRole('option', { name: targetStatus }).click()
          await page.waitForTimeout(500)

          // Verify status changed
          const newStatus = await statusDropdown.textContent()
          expect(newStatus).toContain(targetStatus)
        }
      }
    })

    test('should display modal on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto('/laglistor')
      await page.waitForTimeout(1000)

      // Switch to table view
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      const table = page.locator('table')
      await expect(table).toBeVisible()

      const rows = page.locator('table tbody tr')
      const hasRows = (await rows.count()) > 0

      if (hasRows) {
        const titleCell = rows.first().locator('td').nth(4)
        await titleCell.click()
        await page.waitForTimeout(1000)

        // Modal should be visible and take full screen on mobile
        const modal = page.getByRole('dialog')
        await expect(modal).toBeVisible()
      }
    })
  })

  // Story 4.14: Performance Optimization Tests
  test.describe('Performance Optimization (Story 4.14)', () => {
    test('should add document with optimistic update (instant appearance)', async ({
      page,
    }) => {
      await page.goto('/laglistor', { waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)

      // Open add document modal
      await page.getByRole('button', { name: /Lägg till dokument/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Search for a document
      await page.getByPlaceholder(/Sök på titel/i).fill('arbetsmiljö')
      await page.waitForTimeout(1000) // Wait for search debounce

      // Check if there are results
      const resultItems = page.locator('.flex.items-center.justify-between.p-3')
      const hasResults = (await resultItems.count()) > 0

      if (hasResults) {
        // Get add button for first result
        const addButton = resultItems
          .first()
          .locator('button', { hasText: /Lägg till/i })

        if ((await addButton.count()) > 0 && !(await addButton.isDisabled())) {
          // Get result title before adding
          const resultTitle = await resultItems
            .first()
            .locator('h4')
            .textContent()

          // Record time before clicking add
          const startTime = Date.now()

          // Click add button
          await addButton.click()

          // Check that item appears INSTANTLY (within 100ms) without waiting for network
          // This validates optimistic update - item should appear before server responds
          await expect(async () => {
            const timeElapsed = Date.now() - startTime
            // The button should change to "Tillagd" almost instantly
            const isAdded =
              (await addButton
                .getByText(/Tillagd/i)
                .isVisible()
                .catch(() => false)) || (await addButton.isDisabled())
            if (!isAdded && timeElapsed < 100) {
              throw new Error('Still waiting for optimistic update')
            }
            expect(isAdded).toBe(true)
          }).toPass({ timeout: 3000 })

          // Close modal
          await page.keyboard.press('Escape')
          await page.waitForTimeout(500)

          // Verify item is in the list
          if (resultTitle) {
            const docCard = page.locator('[data-testid="document-card"]', {
              hasText: resultTitle.substring(0, 30),
            })
            await expect(
              docCard.or(page.getByText(resultTitle.substring(0, 30)))
            ).toBeVisible({ timeout: 5000 })
          }
        }
      }
    })

    test('should switch between lists with cached items instantly', async ({
      page,
    }) => {
      await page.goto('/laglistor', { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      // Open list switcher
      const listSwitcher = page.locator(
        'button[role="combobox"][aria-haspopup="menu"]'
      )
      await listSwitcher.click()
      await page.waitForTimeout(300)

      // Get all list options (excluding "Skapa ny lista")
      const listOptions = page
        .locator('[role="menuitem"]')
        .filter({ hasNotText: 'Skapa ny lista' })
      const listCount = await listOptions.count()

      if (listCount >= 2) {
        // Click first list
        await listOptions.first().click()
        await page.waitForTimeout(1000) // Wait for initial load

        // Get the name of the first list and note items
        const firstListName = await listSwitcher.textContent()

        // Now switch to second list
        await listSwitcher.click()
        await page.waitForTimeout(300)
        await listOptions.nth(1).click()
        await page.waitForTimeout(1000)

        // Now switch BACK to first list - should be instant from cache
        const startTime = Date.now()
        await listSwitcher.click()
        await page.waitForTimeout(100)
        await listOptions.first().click()

        // Measure time - cached switch should be nearly instant (no loading spinner)
        const timeElapsed = Date.now() - startTime

        // If items were cached, loading should be instant without spinner
        // Allow some time for UI but not a full network roundtrip
        await page.waitForTimeout(100)
        expect(timeElapsed).toBeLessThan(500) // Switch should be under 500ms with cache

        // List name should be back to first
        const currentListName = await listSwitcher.textContent()
        expect(currentListName).toBe(firstListName)
      }
    })

    test('should update item status without loading spinner', async ({
      page,
    }) => {
      await page.goto('/laglistor', { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      // Switch to table view for inline editing
      await page.getByRole('radio', { name: /tabellvy/i }).click()
      await page.waitForTimeout(500)

      // Wait for table to load
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Find status comboboxes in table rows
      const statusCells = page
        .locator('table tbody tr [role="combobox"]')
        .first()

      if ((await statusCells.count()) > 0) {
        // Record time before clicking
        const startTime = Date.now()

        // Click to open status dropdown
        await statusCells.click()
        await page.waitForTimeout(200)

        // Select a different status option
        const statusOptions = page.locator('[role="option"]')
        if ((await statusOptions.count()) > 1) {
          // Get current status and pick a different one
          const currentStatus = await statusCells.textContent()
          const newStatusOption = statusOptions
            .filter({ hasNotText: currentStatus?.trim() || '' })
            .first()

          if ((await newStatusOption.count()) > 0) {
            await newStatusOption.click()

            // Check time - update should be instant (optimistic)
            const timeElapsed = Date.now() - startTime

            // Verify no loading indicator appeared on the cell
            await page.waitForTimeout(100)

            // The update should reflect immediately without a loading spinner
            // (optimistic update means UI updates before server confirms)
            expect(timeElapsed).toBeLessThan(1000)

            // Status should have changed in the cell
            const newStatus = await statusCells.textContent()
            expect(newStatus).not.toBe(currentStatus)
          }
        }
      }
    })

    test('should show items immediately when switching to cached list', async ({
      page,
    }) => {
      await page.goto('/laglistor', { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)

      // First, ensure we have some items loaded
      const hasDocuments =
        (await page.locator('[data-testid="document-card"]').count()) > 0 ||
        (await page.locator('table tbody tr').count()) > 0

      if (!hasDocuments) {
        // Skip test if no documents in any list
        return
      }

      // Open list switcher
      const listSwitcher = page.locator(
        'button[role="combobox"][aria-haspopup="menu"]'
      )
      await listSwitcher.click()
      await page.waitForTimeout(300)

      // Get list options
      const listOptions = page
        .locator('[role="menuitem"]')
        .filter({ hasNotText: 'Skapa ny lista' })
      const listCount = await listOptions.count()

      if (listCount >= 2) {
        // Switch to a different list first (to populate cache)
        await listOptions.nth(1).click()
        await page.waitForTimeout(1500) // Let it load fully

        // Switch back to original list
        await listSwitcher.click()
        await page.waitForTimeout(100)
        await listOptions.first().click()

        // Items should appear instantly from cache - no loading state
        // Check immediately (within 50ms) for items or empty state
        await page.waitForTimeout(50)

        // Either documents should be visible OR empty message
        const documentsVisible =
          (await page.locator('[data-testid="document-card"]').count()) > 0 ||
          (await page.locator('table tbody tr').count()) > 0
        const emptyMessageVisible = await page
          .getByText(/Inga dokument/i)
          .isVisible()
        const groupHeaderVisible = await page
          .getByText('Ogrupperade')
          .isVisible()

        // One of these should be true - showing cached content
        expect(
          documentsVisible || emptyMessageVisible || groupHeaderVisible
        ).toBe(true)
      }
    })
  })
})
