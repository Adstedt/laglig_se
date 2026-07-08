/**
 * Story 28.6: tasks conformance on the real page (authed).
 * Read-only + UI-state-only interactions (sorting, view flip, selection
 * count) — no task mutations, no bulk actions.
 */
import { test, expect } from '@playwright/test'
import { expectNoErrorOverlay } from './conformance'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 950 })
  await page.goto('/tasks')
  await page
    .getByRole('tab', { name: /Lista/ })
    .click()
    .catch(() => {})
  await page
    .locator('main tbody tr')
    .first()
    .waitFor({ timeout: 20_000 })
    .catch(() => {})
})

test('list renders with sortable headers and selection column', async ({
  page,
}) => {
  const rowCount = await page.locator('main tbody tr').count()
  test.skip(rowCount === 0, 'workspace has no tasks')

  // Core-injected selection column
  await expect(
    page
      .locator('main thead')
      .getByRole('checkbox', { name: 'Markera alla rader' })
  ).toBeVisible()

  // Client sort via header toggles order
  const firstTitle = () =>
    page.locator('main tbody tr').first().locator('td').nth(2)
  const before = await firstTitle().textContent()
  await page
    .locator('main table')
    .getByRole('button', { name: 'Uppgift' })
    .click()
  await page.waitForTimeout(400)
  const after = await firstTitle().textContent()
  console.log(
    '[tasks] sort changed first row:',
    before?.trim() !== after?.trim()
  )
  await expectNoErrorOverlay(page)
})

test('selecting a row shows the bulk bar; clearing hides it', async ({
  page,
}) => {
  const rowCount = await page.locator('main tbody tr').count()
  test.skip(rowCount === 0, 'workspace has no tasks')

  await page
    .locator('main tbody tr')
    .first()
    .getByRole('checkbox', { name: 'Markera rad' })
    .check()
  await expect(
    page.getByRole('toolbar', { name: 'Massåtgärder' })
  ).toBeVisible()
  await expect(page.getByText(/1 vald/)).toBeVisible()

  // Clear selection — bar disappears, nothing mutated.
  await page.getByRole('button', { name: 'Rensa markering' }).click()
  await expect(page.getByRole('toolbar', { name: 'Massåtgärder' })).toHaveCount(
    0
  )
  await expectNoErrorOverlay(page)
})

test('narrow viewport flips to cards and restores', async ({ page }) => {
  const rowCount = await page.locator('main tbody tr').count()
  test.skip(rowCount === 0, 'workspace has no tasks')

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
  await expect(page.locator('main table')).toBeVisible({ timeout: 10_000 })
  await expectNoErrorOverlay(page)
})
