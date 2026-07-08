/**
 * Story 28.3: DataTable core conformance — driven against the styleguide
 * harness (/styleguide/data-table): synthetic data, no auth, and a width
 * slider that stands in for the AI-chat sidebar squeeze.
 *
 * Covers the mechanics every migrated table inherits: renderer switch with
 * hysteresis (incl. the thrash test), sorting in both renderers, selection
 * surviving the swap, expansion under virtualization (the 28.1 spike,
 * regression-locked), and column-state persistence round-trips.
 */
import { test, expect } from '@playwright/test'
import {
  collectPageErrors,
  expectNoErrorOverlay,
  expectNoRowOverlap,
  expectView,
  setHarnessWidth,
} from './conformance'

const HARNESS = '/styleguide/data-table'
const STORAGE_KEY = 'styleguide:data-table-demo'

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS)
  // Deterministic start: clear persisted column state from earlier runs.
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY)
  await page.reload()
  await expect(page.locator('table')).toBeVisible()
})

test('renderer switch respects the hysteresis band', async ({ page }) => {
  await setHarnessWidth(page, 900)
  await expectView(page, 'table')

  await setHarnessWidth(page, 600)
  await expectView(page, 'card')

  // Inside the band (640–664): must NOT flip back.
  await setHarnessWidth(page, 655)
  await expectView(page, 'card')

  // Clears the band: table returns.
  await setHarnessWidth(page, 700)
  await expectView(page, 'table')
})

test('rapid width thrashing never loops or flaps (sidebar animation)', async ({
  page,
}) => {
  const errors = collectPageErrors(page)
  for (let i = 0; i < 10; i++) {
    await setHarnessWidth(page, 600)
    await setHarnessWidth(page, 700)
  }
  await setHarnessWidth(page, 900)
  await expectView(page, 'table')
  await expectNoErrorOverlay(page)
  expect(errors.filter((e) => !/ResizeObserver loop/.test(e))).toEqual([])
  // ResizeObserver loop errors specifically must also not occur:
  expect(errors.filter((e) => /ResizeObserver loop/.test(e))).toEqual([])
})

test('sorting works in the table renderer', async ({ page }) => {
  await setHarnessWidth(page, 900)
  // Column order: [select (injected), expand, title, …] → title is td #3.
  const firstTitle = () => page.locator('tbody tr').first().locator('td').nth(2)

  await page.getByRole('button', { name: 'Titel' }).click()
  await expect(firstTitle()).toContainText('Föreskrift 1 om')
  await page.getByRole('button', { name: 'Titel' }).click()
  // Desc: TanStack's alphanumeric sort is number-aware → 1000 leads.
  await expect(firstTitle()).toContainText('Föreskrift 1000')
})

test('sorting works from the card renderer dropdown', async ({ page }) => {
  await setHarnessWidth(page, 500)
  await expectView(page, 'card')

  await page.getByRole('button', { name: /Sortera/ }).click()
  await page.getByRole('menuitem', { name: 'Belopp' }).click()

  // Sorted asc by amount → the cheapest row (100 kr) leads.
  await expect(page.locator('[role="list"]').first()).toContainText('100 kr')
})

test('selection survives the renderer swap', async ({ page }) => {
  await setHarnessWidth(page, 900)
  await page
    .locator('tbody tr')
    .first()
    .getByRole('checkbox', { name: 'Markera rad' })
    .check()
  await expect(page.getByText(/Markerade: 1/)).toBeVisible()

  await setHarnessWidth(page, 500)
  await expectView(page, 'card')
  await expect(page.getByText(/Markerade: 1/)).toBeVisible()
  await expect(
    page
      .locator(
        '[role="list"] [role="checkbox"][data-state="checked"], [role="list"] input:checked, [role="list"] button[data-state="checked"]'
      )
      .first()
  ).toBeVisible()

  await setHarnessWidth(page, 900)
  await expectView(page, 'table')
  await expect(page.getByText(/Markerade: 1/)).toBeVisible()
})

test('expansion under virtualization: no overlap at top/middle/bottom', async ({
  page,
}) => {
  await setHarnessWidth(page, 900)
  // 1000 rows → virtualized.
  await page.locator('select').selectOption('1000')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  const scroller = page
    .locator('table')
    .locator('xpath=ancestor::div[contains(@class, "overflow-x-auto")][1]')

  const expandVisibleRow = async () => {
    await page
      .locator('tbody tr button[aria-label="Visa detalj"]')
      .nth(2)
      .click()
    await expect(page.locator('[data-testid="detail"]').first()).toBeVisible()
    await expectNoRowOverlap(page)
    await expectNoErrorOverlay(page)
  }

  // Top
  await expandVisibleRow()
  // Middle
  await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight / 2))
  await page.waitForTimeout(300)
  await expandVisibleRow()
  // Bottom
  await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight))
  await page.waitForTimeout(300)
  await expandVisibleRow()
})

test('column resize persists across reload; corrupt storage degrades safely', async ({
  page,
}) => {
  await setHarnessWidth(page, 1000)

  // Resize the Titel column +60px via its grip.
  const grip = page.locator('thead [role="separator"]').first()
  const box = (await grip.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {
    steps: 8,
  })
  await page.mouse.up()

  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    STORAGE_KEY
  )
  expect(stored).toContain('"sizing"')
  const sizedTo = JSON.parse(stored!).sizing.title
  expect(sizedTo).toBeGreaterThan(320)

  // Round-trip: reload → the persisted width applies.
  await page.reload()
  await setHarnessWidth(page, 1000)
  const th = page.locator('thead th', { hasText: 'Titel' })
  const width = (await th.boundingBox())!.width
  expect(Math.abs(width - sizedTo)).toBeLessThan(3)

  // Corrupt payload → defaults, no crash.
  await page.evaluate(
    (key) => localStorage.setItem(key, '{definitely not json'),
    STORAGE_KEY
  )
  await page.reload()
  await expect(page.locator('table')).toBeVisible()
  await expectNoErrorOverlay(page)
})
