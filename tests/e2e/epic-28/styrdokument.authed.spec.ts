/**
 * Story 28.4: styrdokument conformance on the real page (authed).
 * Read-only — no archive clicks, no draft edits.
 */
import { test, expect } from '@playwright/test'
import { expectNoErrorOverlay } from './conformance'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 900 })
  await page.goto('/workspace/styrdokument')
  await expect(
    page.getByRole('heading', { name: 'Styrdokument' }).first()
  ).toBeVisible({ timeout: 30_000 })
})

test('table renders with URL-driven sort headers', async ({ page }) => {
  const table = page.locator('main table')
  const rowCount = await page
    .locator('main tbody tr')
    .count()
    .catch(() => 0)
  test.skip(rowCount === 0, 'workspace has no styrdokument')

  await expect(table).toBeVisible({ timeout: 15_000 })
  // Sortable headers render; clicking Titel forwards to the parent's URL sort.
  await table.getByRole('button', { name: 'Titel' }).click()
  await expect(page).toHaveURL(/sort|titel|title/i)
  await expectNoErrorOverlay(page)
})

test('narrow viewport flips to cards and restores', async ({ page }) => {
  const rowCount = await page
    .locator('main tbody tr')
    .count()
    .catch(() => 0)
  test.skip(rowCount === 0, 'workspace has no styrdokument')

  await page.setViewportSize({ width: 500, height: 900 })
  await expect(page.locator('main [role="list"]').first()).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.locator('main table')).toHaveCount(0)

  await page.setViewportSize({ width: 1728, height: 900 })
  await expect(page.locator('main table')).toBeVisible({ timeout: 10_000 })
  await expectNoErrorOverlay(page)
})
