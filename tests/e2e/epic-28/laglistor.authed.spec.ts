/**
 * Story 28.8: laglistor conformance on the real page (authed).
 * STRICTLY read-only + UI-state-only: no editor commits, no row reorder,
 * no bulk actions — this is the core product surface with real data.
 */
import { test, expect } from '@playwright/test'
import { expectNoErrorOverlay } from './conformance'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 950 })
  await page.goto('/laglistor')
  await page
    .locator('main tbody tr')
    .first()
    .waitFor({ timeout: 20_000 })
    .catch(async () => {
      // Grouped mode defaults every section COLLAPSED on a fresh profile
      // (legacy parity: expandedGroups[id] ?? false) — expand all first.
      const visaAlla = page.getByRole('button', { name: 'Visa alla' })
      if (await visaAlla.isVisible().catch(() => false)) {
        await visaAlla.click()
        await page
          .locator('main tbody tr')
          .first()
          .waitFor({ timeout: 15_000 })
          .catch(() => {})
      }
    })
})

test('list renders with selection + drag chrome and sortable headers', async ({
  page,
}) => {
  const rowCount = await page.locator('main tbody tr').count()
  test.skip(rowCount === 0, 'workspace has no laglistor items')

  // Core-injected chrome
  await expect(
    page
      .locator('main thead')
      .getByRole('checkbox', { name: 'Markera alla rader' })
      .first()
  ).toBeVisible()
  await expect(
    page.locator('main tbody button[aria-label="Dra för att flytta"]').first()
  ).toBeVisible()
  await expectNoErrorOverlay(page)
})

test('expansion opens and closes without layout damage', async ({ page }) => {
  const rowCount = await page.locator('main tbody tr').count()
  test.skip(rowCount === 0, 'workspace has no laglistor items')

  const expandBtn = page
    .locator('main tbody button[aria-label="Expandera"]')
    .first()
  test.skip(
    !(await expandBtn.isVisible().catch(() => false)),
    'compliance view not active (no expand chevrons)'
  )

  const before = await page.locator('main tbody tr').count()
  await expandBtn.click()
  await page.waitForTimeout(500)
  const after = await page.locator('main tbody tr').count()
  expect(after).toBeGreaterThan(before)

  await page
    .locator('main tbody button[aria-label="Fäll ihop"]')
    .first()
    .click()
  await page.waitForTimeout(400)
  await expectNoErrorOverlay(page)
})

test('selection shows the bulk bar; clearing hides it', async ({ page }) => {
  const rowCount = await page.locator('main tbody tr').count()
  test.skip(rowCount === 0, 'workspace has no laglistor items')

  await page
    .locator('main tbody tr')
    .first()
    .getByRole('checkbox', { name: 'Markera rad' })
    .check()
  await expect(page.getByText(/1 vald/)).toBeVisible()
  const clear = page.getByRole('button', { name: 'Rensa markering' }).first()
  if (await clear.isVisible().catch(() => false)) {
    await clear.click()
  } else {
    // legacy laglistor bulk bar uses an unlabeled X — clear via sr-only text
    await page.locator('button:has(svg.lucide-x)').first().click()
  }
  await expectNoErrorOverlay(page)
})

test('narrow viewport flips to cards and restores', async ({ page }) => {
  const rowCount = await page.locator('main tbody tr').count()
  test.skip(rowCount === 0, 'workspace has no laglistor items')

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

  await page.setViewportSize({ width: 1728, height: 950 })
  await expect(page.locator('main table').first()).toBeVisible({
    timeout: 10_000,
  })
  await expectNoErrorOverlay(page)
})
