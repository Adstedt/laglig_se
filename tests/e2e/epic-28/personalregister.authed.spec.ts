/**
 * Story 28.7: personalregister conformance on the real page (authed).
 * Read-only + UI-state-only (sort, collapse, view flip) — no group moves,
 * no employee edits. Personnummer stays masked/formatted by the repo layer.
 */
import { test, expect } from '@playwright/test'
import { expectNoErrorOverlay } from './conformance'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 950 })
  await page.goto('/personalregister')
  await expect(
    page.getByRole('heading', { name: /Personalregister|HR/ }).first()
  ).toBeVisible({ timeout: 30_000 })
  await page
    .locator('main tbody tr')
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => {})
})

test('sections render with rollup counts and collapse', async ({ page }) => {
  const rowCount = await page.locator('main tbody tr').count()
  test.skip(rowCount === 0, 'workspace has no employees')

  const sectionToggles = page.locator('main button[data-dt-section-trigger]')
  const sectionCount = await sectionToggles.count()
  test.skip(sectionCount === 0, 'workspace has no employee groups (flat mode)')

  // Rollup text on at least one header
  await expect(page.getByText(/kompletta/).first()).toBeVisible()

  // Collapse the first section → its aria-expanded flips; rows shrink.
  const before = await page.locator('main tbody tr').count()
  await sectionToggles.first().click()
  await expect(sectionToggles.first()).toHaveAttribute('aria-expanded', 'false')
  await page.waitForTimeout(400)
  const after = await page.locator('main tbody tr').count()
  console.log('[hr] rows before/after collapse:', before, after)
  await sectionToggles.first().click()
  await expectNoErrorOverlay(page)
})

test('per-section sorting is independent', async ({ page }) => {
  const tables = page.locator('main table')
  const tableCount = await tables.count()
  test.skip(tableCount < 2, 'needs at least two visible sections with rows')

  // Sort section 1 by name; section 2's first row must not change.
  const secondFirstRow = () =>
    tables.nth(1).locator('tbody tr').first().textContent()
  const secondBefore = await secondFirstRow()
  await tables.first().getByRole('button', { name: 'Anställd' }).click()
  await page.waitForTimeout(400)
  const secondAfter = await secondFirstRow()
  expect(secondAfter).toBe(secondBefore)
  await expectNoErrorOverlay(page)
})

test('narrow viewport flips sections to cards', async ({ page }) => {
  const rowCount = await page.locator('main tbody tr').count()
  test.skip(rowCount === 0, 'workspace has no employees')

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
  await expect(page.locator('main table')).toHaveCount(0)

  await page.setViewportSize({ width: 1728, height: 950 })
  await expect(page.locator('main table').first()).toBeVisible({
    timeout: 10_000,
  })
  await expectNoErrorOverlay(page)
})
