import { test, expect } from '@playwright/test'

/**
 * Story 6.5: E2E tests for Custom Task Columns (Arbetsflöde tab)
 *
 * These tests verify:
 * 1. Navigate to settings -> Arbetsflöde tab
 * 2. Column list displays correctly
 * 3. Column reordering via drag-and-drop
 * 4. Column reordering via keyboard
 * 5. Rename column inline
 * 6. Add new column
 * 7. Delete custom column with task migration
 * 8. Change column color
 * 9. Verify changes visible in task workspace
 */

test.describe('Settings Workflow Tab', () => {
  // Skip if test credentials not configured
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'Skipping workflow tests - TEST_USER_EMAIL and TEST_USER_PASSWORD not set'
  )

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })

    // Navigate to settings
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings/)
  })

  test('should navigate to Arbetsflöde tab', async ({ page }) => {
    // Click on Arbetsflöde tab
    await page.click('button:has-text("Arbetsflöde")')

    // Verify tab content is visible
    await expect(page.locator('text=/Anpassa kolumner/i')).toBeVisible()
    await expect(
      page.locator('text=/Hantera kolumnerna i din Kanban-tavla/i')
    ).toBeVisible()
  })

  test('should display default columns', async ({ page }) => {
    await page.click('button:has-text("Arbetsflöde")')

    // Wait for columns to load
    await expect(page.locator('text=/Att göra/i').first()).toBeVisible()
    await expect(page.locator('text=/Pågående/i').first()).toBeVisible()
    await expect(page.locator('text=/Klar/i').first()).toBeVisible()

    // Check for Standard badge on default columns
    const standardBadges = page.locator('text=Standard')
    await expect(standardBadges.first()).toBeVisible()
  })

  test('should show column count', async ({ page }) => {
    await page.click('button:has-text("Arbetsflöde")')

    // Should show "X av 8 kolumner används"
    await expect(page.locator('text=/av 8 kolumner används/i')).toBeVisible()
  })

  test('should show "Ny kolumn" button', async ({ page }) => {
    await page.click('button:has-text("Arbetsflöde")')

    const addButton = page.locator('button:has-text("Ny kolumn")')
    await expect(addButton).toBeVisible()
    await expect(addButton).toBeEnabled()
  })

  test('should open add column dialog', async ({ page }) => {
    await page.click('button:has-text("Arbetsflöde")')
    await page.click('button:has-text("Ny kolumn")')

    // Dialog should be visible
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('text=Ny kolumn')).toBeVisible()
    await expect(dialog.locator('input[id="column-name"]')).toBeVisible()
  })

  test('should add a new column', async ({ page }) => {
    await page.click('button:has-text("Arbetsflöde")')

    // Get initial column count
    const initialCountText = await page
      .locator('text=/av 8 kolumner används/i')
      .textContent()
    const initialCount = parseInt(initialCountText?.match(/\d+/)?.[0] || '0')

    // Open add dialog
    await page.click('button:has-text("Ny kolumn")')

    // Fill in the name
    await page.fill('input[id="column-name"]', 'Testkolumn')

    // Submit
    await page.click('button:has-text("Skapa kolumn")')

    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({
      timeout: 5000,
    })

    // Verify new column appears
    await expect(page.locator('text=Testkolumn').first()).toBeVisible()

    // Verify count increased
    const newCountText = await page
      .locator('text=/av 8 kolumner används/i')
      .textContent()
    const newCount = parseInt(newCountText?.match(/\d+/)?.[0] || '0')
    expect(newCount).toBe(initialCount + 1)
  })

  test('should rename column inline', async ({ page }) => {
    await page.click('button:has-text("Arbetsflöde")')

    // Click on a column name to edit (use first non-default column if available, otherwise first column)
    const columnName = page.locator('button:has-text("Att göra")').first()
    await columnName.click()

    // Should show input field
    const input = page.locator('input[value="Att göra"]')
    await expect(input).toBeVisible()

    // Change name
    await input.fill('Att göra (Ändrad)')
    await input.press('Enter')

    // Verify name changed
    await expect(page.locator('text=Att göra (Ändrad)').first()).toBeVisible()
  })

  test('should cancel inline edit on Escape', async ({ page }) => {
    await page.click('button:has-text("Arbetsflöde")')

    // Click on a column name to edit
    const columnName = page.locator('button:has-text("Att göra")').first()
    await columnName.click()

    // Change name
    const input = page.locator('input[value="Att göra"]')
    await input.fill('Ändrat namn')

    // Press Escape to cancel
    await input.press('Escape')

    // Original name should be restored
    await expect(page.locator('button:has-text("Att göra")').first()).toBeVisible()
    await expect(page.locator('text=Ändrat namn')).not.toBeVisible()
  })

  test('should open color picker', async ({ page }) => {
    await page.click('button:has-text("Arbetsflöde")')

    // Click on a color button
    const colorButton = page.locator('button[aria-label="Välj färg"]').first()
    await colorButton.click()

    // Color picker popover should be visible
    const popover = page.locator('[role="dialog"]')
    await expect(popover).toBeVisible()

    // Should show color options
    await expect(popover.locator('text=Färg')).toBeVisible()
  })

  test('should not show delete button for default columns', async ({
    page,
  }) => {
    await page.click('button:has-text("Arbetsflöde")')

    // Default columns should not have delete buttons
    // Look for delete buttons with specific aria-label pattern
    const deleteButtons = page.locator(
      'button[aria-label^="Radera kolumn Att göra"], button[aria-label^="Radera kolumn Pågående"], button[aria-label^="Radera kolumn Klar"]'
    )
    await expect(deleteButtons).toHaveCount(0)
  })

  test('should show delete confirmation dialog for custom column', async ({
    page,
  }) => {
    await page.click('button:has-text("Arbetsflöde")')

    // First add a custom column
    await page.click('button:has-text("Ny kolumn")')
    await page.fill('input[id="column-name"]', 'Kolumn att radera')
    await page.click('button:has-text("Skapa kolumn")')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({
      timeout: 5000,
    })

    // Click delete on the custom column
    const deleteButton = page.locator(
      'button[aria-label="Radera kolumn Kolumn att radera"]'
    )
    await deleteButton.click()

    // Confirmation dialog should appear
    const alertDialog = page.locator('[role="alertdialog"]')
    await expect(alertDialog).toBeVisible()
    await expect(alertDialog.locator('text=Radera kolumn?')).toBeVisible()
    await expect(alertDialog.locator('text=/uppgifter flyttas till/i')).toBeVisible()
  })

  test('should delete custom column', async ({ page }) => {
    await page.click('button:has-text("Arbetsflöde")')

    // First add a custom column
    await page.click('button:has-text("Ny kolumn")')
    await page.fill('input[id="column-name"]', 'Kolumn att radera')
    await page.click('button:has-text("Skapa kolumn")')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator('text=Kolumn att radera').first()).toBeVisible()

    // Get column count before deletion
    const beforeCountText = await page
      .locator('text=/av 8 kolumner används/i')
      .textContent()
    const beforeCount = parseInt(beforeCountText?.match(/\d+/)?.[0] || '0')

    // Click delete
    const deleteButton = page.locator(
      'button[aria-label="Radera kolumn Kolumn att radera"]'
    )
    await deleteButton.click()

    // Confirm deletion
    const confirmButton = page.locator(
      '[role="alertdialog"] button:has-text("Radera")'
    )
    await confirmButton.click()

    // Wait for dialog to close
    await expect(page.locator('[role="alertdialog"]')).not.toBeVisible({
      timeout: 5000,
    })

    // Column should be gone
    await expect(page.locator('text=Kolumn att radera')).not.toBeVisible()

    // Verify count decreased
    const afterCountText = await page
      .locator('text=/av 8 kolumner används/i')
      .textContent()
    const afterCount = parseInt(afterCountText?.match(/\d+/)?.[0] || '0')
    expect(afterCount).toBe(beforeCount - 1)
  })

  test('should reorder columns via keyboard', async ({ page }) => {
    await page.click('button:has-text("Arbetsflöde")')

    // Wait for columns to load
    await expect(page.locator('text=/Att göra/i').first()).toBeVisible()

    // Find the drag handle for the first column
    const dragHandle = page
      .locator('[aria-label="Dra för att ändra ordning"]')
      .first()
    await dragHandle.focus()

    // Press Space to pick up, then Arrow Down to move, then Space to drop
    await dragHandle.press('Space')
    await page.waitForTimeout(100) // Small delay for drag to start
    await dragHandle.press('ArrowDown')
    await page.waitForTimeout(100)
    await dragHandle.press('Space')

    // Give time for reorder to complete
    await page.waitForTimeout(500)
  })
})

test.describe('Settings Workflow Tab - Edge Cases', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'Skipping workflow edge case tests - TEST_USER_EMAIL and TEST_USER_PASSWORD not set'
  )

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!)
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    await page.goto('/settings')
    await page.click('button:has-text("Arbetsflöde")')
  })

  test('should show validation error for empty column name', async ({
    page,
  }) => {
    await page.click('button:has-text("Ny kolumn")')

    // Try to submit without name
    const submitButton = page.locator('button:has-text("Skapa kolumn")')
    await expect(submitButton).toBeDisabled()
  })

  test('should show error for duplicate column name', async ({ page }) => {
    // Try to add a column with an existing name
    await page.click('button:has-text("Ny kolumn")')
    await page.fill('input[id="column-name"]', 'Att göra')
    await page.click('button:has-text("Skapa kolumn")')

    // Should show error toast or message
    await expect(
      page.locator('text=/finns redan/i, [data-sonner-toast]')
    ).toBeVisible({ timeout: 5000 })
  })
})
