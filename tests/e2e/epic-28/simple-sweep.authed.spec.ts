/**
 * Story 28.11: simple-table sweep conformance (authed, read-only).
 * Covers the two migrated surfaces: /laglistor/kontroller (cycle list)
 * and /filer list view (file list). UI-state-only — no mutations.
 */
import { test, expect } from '@playwright/test'
import { expectNoErrorOverlay } from './conformance'

test.describe('kontroller cycle list', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 950 })
    await page.goto('/laglistor/kontroller')
    await page
      .getByRole('heading', { name: 'Kontroller' })
      .waitFor({ timeout: 20_000 })
  })

  test('renders core table with sortable headers, or the empty state', async ({
    page,
  }) => {
    const table = page.locator('main table')
    const hasTable = await table
      .first()
      .isVisible()
      .catch(() => false)
    if (!hasTable) {
      await expect(page.getByText(/Inga kontroller/).first()).toBeVisible()
      await expectNoErrorOverlay(page)
      return
    }
    await expect(
      table.first().getByRole('button', { name: 'Namn' })
    ).toBeVisible()
    // Sort toggle round-trip should not error.
    await table.first().getByRole('button', { name: 'Status' }).click()
    await expectNoErrorOverlay(page)
  })

  test('narrow viewport flips the cycle list to cards', async ({ page }) => {
    const rowCount = await page.locator('main tbody tr').count()
    test.skip(rowCount === 0, 'workspace has no cycles')

    await page.setViewportSize({ width: 500, height: 950 })
    await page.waitForTimeout(600)
    if (
      await page
        .getByTestId('chat-modal')
        .isVisible()
        .catch(() => false)
    ) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    }
    await expect(page.locator('main [role="list"]').first()).toBeVisible({
      timeout: 10_000,
    })
    await expectNoErrorOverlay(page)
  })
})

test.describe('filer list view', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 950 })
    await page.goto('/filer')
    // List view is the default; ensure the browser shell is up.
    await page
      .getByRole('radio', { name: 'Listvy' })
      .or(page.getByRole('button', { name: 'Listvy' }))
      .first()
      .waitFor({ timeout: 20_000 })
  })

  test('file list renders on the core with sortable headers', async ({
    page,
  }) => {
    const table = page.locator('main table')
    const hasTable = await table
      .first()
      .isVisible()
      .catch(() => false)
    test.skip(!hasTable, 'workspace has no files/folders in list view')

    await expect(
      table.first().getByRole('button', { name: 'Namn' })
    ).toBeVisible()
    // Sort by size and back — read-only state change only.
    await table.first().getByRole('button', { name: 'Storlek' }).click()
    await expectNoErrorOverlay(page)
  })
})
