/**
 * Story 28.3: krav conformance on the real page (authed).
 * Read-only interactions ONLY — the test user's workspace is real data,
 * so no toggle clicks, no assignee changes.
 */
import { test, expect } from '@playwright/test'
import { expectNoErrorOverlay } from './conformance'

test.beforeEach(async ({ page }) => {
  // Wide viewport: a fresh profile opens the AI-chat sidebar by default
  // (480px), and table-view assertions need a container above the 800px
  // card threshold regardless.
  await page.setViewportSize({ width: 1728, height: 900 })
  await page.goto('/krav')
  // Generous timeout: the dev server compiles routes on demand, so the
  // first render of /krav in a fresh worker can take well over 5s.
  await expect(
    page.getByRole('heading', { name: 'Krav', exact: true })
  ).toBeVisible({ timeout: 30_000 })
})

test('URL-driven sort survives a full reload', async ({ page }) => {
  await expect(page.locator('table')).toBeVisible({ timeout: 15_000 })

  await page
    .getByRole('table')
    .getByRole('button', { name: 'Regelverk' })
    .click()
  await expect(page).toHaveURL(/sort=law_name/)

  await page.reload()
  await expect(page.locator('table')).toBeVisible()
  await expect(page).toHaveURL(/sort=law_name/)
  // The sorted header shows a direction arrow (not the neutral icon).
  const header = page
    .getByRole('table')
    .getByRole('button', { name: 'Regelverk' })
  await expect(header.locator('svg')).toBeVisible()
})

test('narrow viewport flips to cards with the compact toolbar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 500, height: 900 })
  await expect(page.locator('[role="list"]').first()).toBeVisible()
  await expect(page.locator('main table')).toHaveCount(0)

  // Compact toolbar: filter dropdown replaces the chips; sort menu present.
  await expect(
    page.locator('button[aria-label="Filtrera kravpunkter"]')
  ).toBeVisible()
  await expect(page.locator('main input[placeholder="Sök…"]')).toBeVisible()

  // Restore: the table comes back. (1728: with the chat open by default,
  // 1440 would land inside the hysteresis band and legitimately stay cards.)
  await page.setViewportSize({ width: 1728, height: 900 })
  await expect(page.locator('main table')).toBeVisible()
  await expectNoErrorOverlay(page)
})

test('row click opens the law modal; Escape closes it', async ({ page }) => {
  await expect(page.locator('table')).toBeVisible()
  const rowCount = await page.locator('tbody tr').count()
  test.skip(rowCount === 0, 'workspace has no krav rows')

  await page.locator('tbody tr').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
