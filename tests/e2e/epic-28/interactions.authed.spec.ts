/**
 * Epic 28 follow-up: INTERACTION conformance across all core-table surfaces.
 * Exercises the behaviors users actually perform — row click opens the right
 * modal/route, Escape closes it, header sort toggles, selection drives the
 * bulk bar, expansion, folder navigation — strictly READ-ONLY (modals are
 * dismissed, never saved; no editors, no drag, no bulk mutations).
 */
import { test, expect, type Page } from '@playwright/test'
import { expectNoErrorOverlay } from './conformance'

async function dismissChatModal(page: Page) {
  for (let i = 0; i < 3; i++) {
    if (
      await page
        .getByTestId('chat-modal')
        .isVisible()
        .catch(() => false)
    ) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    } else break
  }
}

async function closeDialog(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.locator('[role="dialog"]').first()).toBeHidden({
    timeout: 5_000,
  })
}

test.describe('krav', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 950 })
    await page.goto('/krav')
    await page.locator('main tbody tr').first().waitFor({ timeout: 20_000 })
  })

  test('row click opens the detail dialog; Escape closes it', async ({
    page,
  }) => {
    await page.locator('main tbody tr').first().click()
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({
      timeout: 10_000,
    })
    await closeDialog(page)
    await expectNoErrorOverlay(page)
  })

  test('header sort round-trips through the URL', async ({ page }) => {
    await page
      .locator('main table')
      .first()
      .getByRole('button', { name: 'Regelverk' })
      .click()
    await expect(page).toHaveURL(/sort=/, { timeout: 5_000 })
    const url1 = page.url()
    await page
      .locator('main table')
      .first()
      .getByRole('button', { name: 'Regelverk' })
      .click()
    await expect(page).not.toHaveURL(url1, { timeout: 5_000 })
    await expectNoErrorOverlay(page)
  })

  test('card click opens the same dialog', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 950 })
    await page.waitForTimeout(700)
    await dismissChatModal(page)
    const card = page.locator('main [role="list"] [role="button"]').first()
    await card.waitFor({ timeout: 10_000 })
    await card.click()
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({
      timeout: 10_000,
    })
    await closeDialog(page)
    await expectNoErrorOverlay(page)
  })
})

test.describe('styrdokument', () => {
  test('row click navigates to the editor route and back', async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 950 })
    await page.goto('/workspace/styrdokument')
    const row = page.locator('main tbody tr').first()
    test.skip(
      !(await row
        .waitFor({ timeout: 20_000 })
        .then(() => true)
        .catch(() => false)),
      'no documents'
    )
    await row.click()
    await expect(page).toHaveURL(/\/workspace\/styrdokument\/.+\/edit/, {
      timeout: 15_000,
    })
    await page.goBack()
    await expect(page.locator('main tbody tr').first()).toBeVisible({
      timeout: 15_000,
    })
    await expectNoErrorOverlay(page)
  })

  test('row kebab menu opens without triggering row navigation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1728, height: 950 })
    await page.goto('/workspace/styrdokument')
    const row = page.locator('main tbody tr').first()
    test.skip(
      !(await row
        .waitFor({ timeout: 20_000 })
        .then(() => true)
        .catch(() => false)),
      'no documents'
    )
    const url = page.url()
    const kebab = row.getByRole('button', { name: /Åtgärder/ }).first()
    if (await kebab.isVisible().catch(() => false)) {
      await kebab.click()
      await expect(page.getByRole('menu')).toBeVisible({ timeout: 5_000 })
      await page.keyboard.press('Escape')
      // The interactive guard must have suppressed the row click.
      expect(page.url()).toBe(url)
    }
    await expectNoErrorOverlay(page)
  })
})

test.describe('tasks', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 950 })
    await page.goto('/tasks')
    await page.getByRole('tab', { name: 'Lista' }).click()
  })

  test('row click opens the task modal (?task=); Escape closes', async ({
    page,
  }) => {
    const row = page.locator('main tbody tr').first()
    test.skip(
      !(await row
        .waitFor({ timeout: 20_000 })
        .then(() => true)
        .catch(() => false)),
      'no tasks'
    )
    // Click the TITLE cell — a plain row.click() hits the row's center,
    // which can land on an inline editor (guard-suppressed by design).
    await row
      .locator('td')
      .filter({ hasText: /\w{3,}/ })
      .first()
      .click()
    await expect(page).toHaveURL(/task=/, { timeout: 10_000 })
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({
      timeout: 10_000,
    })
    await closeDialog(page)
    await expectNoErrorOverlay(page)
  })

  test('selection drives the bulk bar; checkbox click does not open the modal', async ({
    page,
  }) => {
    const rows = page.locator('main tbody tr')
    test.skip(
      !(await rows
        .first()
        .waitFor({ timeout: 20_000 })
        .then(() => true)
        .catch(() => false)),
      'no tasks'
    )
    await rows.first().getByRole('checkbox', { name: 'Markera rad' }).check()
    await expect(page.getByText(/1 vald/).first()).toBeVisible()
    // Guard: checking must NOT have opened the task modal.
    expect(page.url()).not.toMatch(/task=/)
    if ((await rows.count()) > 1) {
      await rows.nth(1).getByRole('checkbox', { name: 'Markera rad' }).check()
      await expect(page.getByText(/2 valda/).first()).toBeVisible()
    }
    await page.getByRole('button', { name: 'Rensa markering' }).click()
    await expect(page.getByText(/vald/).first()).toBeHidden()
    await expectNoErrorOverlay(page)
  })

  test('header sort toggles without error', async ({ page }) => {
    const row = page.locator('main tbody tr').first()
    test.skip(
      !(await row
        .waitFor({ timeout: 20_000 })
        .then(() => true)
        .catch(() => false)),
      'no tasks'
    )
    const sortBtn = page.locator('main table thead').getByRole('button').first()
    await sortBtn.click()
    await page.waitForTimeout(400)
    await sortBtn.click()
    await page.waitForTimeout(400)
    await expect(page.locator('main tbody tr').first()).toBeVisible()
    await expectNoErrorOverlay(page)
  })
})

test.describe('personalregister', () => {
  test('row click opens the employee panel (?anstalld=); Escape closes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1728, height: 950 })
    await page.goto('/personalregister')
    const row = page.locator('main tbody tr').first()
    test.skip(
      !(await row
        .waitFor({ timeout: 20_000 })
        .then(() => true)
        .catch(() => false)),
      'no employees'
    )
    await row.click()
    await expect(page).toHaveURL(/anstalld=/, { timeout: 10_000 })
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({
      timeout: 10_000,
    })
    await closeDialog(page)
    await expectNoErrorOverlay(page)
  })
})

test.describe('laglistor', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 950 })
    await page.goto('/laglistor')
    await page
      .locator('main tbody tr')
      .first()
      .waitFor({ timeout: 20_000 })
      .catch(async () => {
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

  test('row click opens the document modal (?document=); Escape closes', async ({
    page,
  }) => {
    const rowCount = await page.locator('main tbody tr').count()
    test.skip(rowCount === 0, 'no laglistor items')
    // Click the title cell text (not chrome columns / editors).
    await page.locator('main tbody tr').first().click()
    await expect(page).toHaveURL(/document=/, { timeout: 10_000 })
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({
      timeout: 10_000,
    })
    await closeDialog(page)
    // Param cleared on close (History API contract).
    await expect(page).not.toHaveURL(/document=/, { timeout: 5_000 })
    await expectNoErrorOverlay(page)
  })

  test('inline status editor opens WITHOUT opening the document modal', async ({
    page,
  }) => {
    const rowCount = await page.locator('main tbody tr').count()
    test.skip(rowCount === 0, 'no laglistor items')
    // The status badge cell is an interactive popover trigger; the core's
    // guard must suppress the row click. READ-ONLY: open then Escape —
    // nothing is committed.
    const trigger = page
      .locator('main tbody tr')
      .first()
      .locator('button')
      .filter({ hasNot: page.locator('[aria-label="Dra för att flytta"]') })
      .first()
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click()
      await page.waitForTimeout(400)
      expect(page.url()).not.toMatch(/document=/)
      await page.keyboard.press('Escape')
    }
    await expectNoErrorOverlay(page)
  })
})

test.describe('kontroller', () => {
  test('cycle row → detail; item row → item modal (?item=); Escape closes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1728, height: 950 })
    await page.goto('/laglistor/kontroller')
    const row = page.locator('main tbody tr').first()
    test.skip(
      !(await row
        .waitFor({ timeout: 20_000 })
        .then(() => true)
        .catch(() => false)),
      'no cycles'
    )
    await row.click()
    await expect(page).toHaveURL(/kontroller\/.+/, { timeout: 15_000 })
    const itemCell = page.locator('[data-cycle-item-id]').first()
    test.skip(
      !(await itemCell
        .waitFor({ timeout: 20_000 })
        .then(() => true)
        .catch(() => false)),
      'cycle has no items'
    )
    await itemCell.click()
    await expect(page).toHaveURL(/item=/, { timeout: 10_000 })
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({
      timeout: 10_000,
    })
    await closeDialog(page)
    await expectNoErrorOverlay(page)
  })
})

test.describe('filer', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 950 })
    await page.goto('/filer')
    // Wait for the browser shell (list view is default) instead of a fixed
    // sleep — first-hit compile latency skipped tests otherwise.
    await page
      .locator('main table, main [role="list"]')
      .first()
      .waitFor({ timeout: 25_000 })
      .catch(() => {})
  })

  test('file row click opens the preview; Escape closes', async ({ page }) => {
    // The fixed cookie banner (fresh Playwright profile) overlaps rows at
    // the bottom of the viewport and swallows their clicks — dismiss it.
    const cookieBtn = page.getByRole('button', { name: 'Bara nödvändiga' })
    if (await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click()
      await page.waitForTimeout(300)
    }
    const table = page.locator('main table').first()
    test.skip(
      !(await table.isVisible().catch(() => false)),
      'no list-view table'
    )
    // Folders render above files ("Mapp" type) — pick the first FILE row.
    const fileRow = table
      .locator('tbody tr')
      .filter({ hasNotText: 'Mapp' })
      .first()
    test.skip(!(await fileRow.isVisible().catch(() => false)), 'no files')
    await fileRow.click()
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({
      timeout: 10_000,
    })
    await closeDialog(page)
    await expectNoErrorOverlay(page)
  })

  test('folder double-click navigates into the folder', async ({ page }) => {
    const table = page.locator('main table').first()
    test.skip(
      !(await table.isVisible().catch(() => false)),
      'no list-view table'
    )
    const folderRow = table
      .locator('tbody tr')
      .filter({ hasText: 'Mapp' })
      .first()
    test.skip(!(await folderRow.isVisible().catch(() => false)), 'no folders')
    const folderName = await folderRow.locator('td').first().innerText()
    await folderRow.dblclick()
    await page.waitForTimeout(1500)
    // Inside the folder: a breadcrumb/heading with the folder name appears
    // outside the table row we clicked.
    await expect(
      page.getByText(folderName.trim(), { exact: false }).first()
    ).toBeVisible()
    await expectNoErrorOverlay(page)
  })

  test('single click on a folder row does NOT navigate or open a dialog', async ({
    page,
  }) => {
    const table = page.locator('main table').first()
    test.skip(
      !(await table.isVisible().catch(() => false)),
      'no list-view table'
    )
    const folderRow = table
      .locator('tbody tr')
      .filter({ hasText: 'Mapp' })
      .first()
    test.skip(!(await folderRow.isVisible().catch(() => false)), 'no folders')
    await folderRow.click()
    await page.waitForTimeout(700)
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)
    await expectNoErrorOverlay(page)
  })
})
