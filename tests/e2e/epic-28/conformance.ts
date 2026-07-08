/**
 * Story 28.3: shared helpers for the DataTable conformance suite.
 *
 * Enrolling a table = writing a spec that drives THAT surface (its own
 * data, auth, and way of narrowing the container) and calling these
 * assertions. The styleguide harness covers core mechanics with synthetic
 * data; per-table specs (krav first) cover real-page integration.
 */
import { expect, type Page } from '@playwright/test'

/** Set the harness's container-width slider (styleguide page only). */
export async function setHarnessWidth(page: Page, width: number) {
  await page.locator('input[type="range"]').evaluate((el, w) => {
    const input = el as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )!.set!
    setter.call(input, String(w))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, width)
}

/** Which renderer is mounted right now. */
export async function expectView(page: Page, view: 'table' | 'card') {
  if (view === 'table') {
    await expect(page.locator('main table, table').first()).toBeVisible()
  } else {
    await expect(page.locator('[role="list"]').first()).toBeVisible()
    await expect(page.locator('main table, table')).toHaveCount(0)
  }
}

/** The Next.js dev/prod error overlay must never appear. */
export async function expectNoErrorOverlay(page: Page) {
  const overlayText = await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal')
    const dialog = portal?.shadowRoot?.querySelector('[data-nextjs-dialog]')
    return dialog?.textContent ?? null
  })
  expect(overlayText, `Next error overlay: ${overlayText}`).toBeNull()
}

/**
 * Collect page errors (uncaught exceptions) for the duration of a test.
 * Call before interactions; assert the returned array afterwards.
 * Console noise (CSP for analytics scripts in dev) is not collected —
 * only real uncaught errors.
 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

/**
 * Virtualized rows must never overlap: sort all row boxes by their
 * translateY and assert each row ends before the next begins (±1px).
 */
export async function expectNoRowOverlap(page: Page) {
  const overlaps = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tbody tr')]
      .map((tr) => {
        const m = (tr as HTMLElement).style.transform.match(
          /translateY\(([\d.]+)px\)/
        )
        return {
          y: m ? parseFloat(m[1]!) : -1,
          h: tr.getBoundingClientRect().height,
        }
      })
      .filter((r) => r.y >= 0)
      .sort((a, b) => a.y - b.y)
    const bad: string[] = []
    for (let i = 0; i < rows.length - 1; i++) {
      if (rows[i]!.y + rows[i]!.h > rows[i + 1]!.y + 1) {
        bad.push(
          `row@${rows[i]!.y} (h=${rows[i]!.h}) overlaps ${rows[i + 1]!.y}`
        )
      }
    }
    return bad
  })
  expect(overlaps).toEqual([])
}
