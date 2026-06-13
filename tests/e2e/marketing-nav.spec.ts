/**
 * E2E: Marketing megamenu (Story 26.2 / 26.4 AC 13)
 *
 * Closes QA-26.2-1 — the unit tests asserted nav state via the mobile sheet
 * (Radix hover menus are flaky in happy-dom); this proves the DESKTOP
 * NavigationMenu opens on hover, published industries are live links, and
 * unpublished ones render as non-link "Kommer snart" items.
 *
 * Published-state is derived from content/marketing/ at test time (same walk
 * as getPublishedMarketingRoutes) so the suite keeps passing as 26.5–26.8
 * publish pages — no hard-coded inventory (QA-26.4-F).
 */
import { test, expect } from '@playwright/test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  BRANSCHER_NAV,
  FUNKTIONER_NAV,
  OMRADEN_NAV,
} from '../../lib/marketing/nav-links'

function publishedRoutes(
  kind: 'branscher' | 'funktioner' | 'omraden'
): string[] {
  const dir = join(process.cwd(), 'content', 'marketing', kind)
  return readdirSync(dir)
    .filter((f) => f.endsWith('.mdx') && !f.startsWith('_'))
    .map((f) => `/${kind}/${f.replace(/\.mdx$/, '')}`)
}

const publishedBranscher = publishedRoutes('branscher')
const publishedFunktioner = publishedRoutes('funktioner')
const publishedOmraden = publishedRoutes('omraden')

const liveFunktioner = FUNKTIONER_NAV.filter((i) =>
  publishedFunktioner.includes(i.route)
)
// Funktioner items differ from Branscher: unpublished items resolve to a
// homepage-anchor fallback (resolveNavHref type 'anchor'), NOT "Kommer snart".
const anchorFunktioner = FUNKTIONER_NAV.filter(
  (i) => !publishedFunktioner.includes(i.route) && i.anchorFallback
)

const liveBranscher = BRANSCHER_NAV.filter((i) =>
  publishedBranscher.includes(i.route)
)
const comingSoonBranscher = BRANSCHER_NAV.filter(
  (i) => !publishedBranscher.includes(i.route)
)
const liveOmraden = OMRADEN_NAV.filter((i) =>
  publishedOmraden.includes(i.route)
)
const comingSoonOmraden = OMRADEN_NAV.filter(
  (i) => !publishedOmraden.includes(i.route)
)

test.describe('Marketing megamenu — Branscher / Områden', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    // NavbarV3 renders the NavigationMenu only after the mount effect.
    await expect(page.getByRole('button', { name: 'Branscher' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('Branscher: published industries are live links with canonical hrefs', async ({
    page,
  }) => {
    test.skip(liveBranscher.length === 0, 'no published industry pages yet')
    await page.getByRole('button', { name: 'Branscher' }).hover()

    const first = liveBranscher[0]!
    const firstLink = page.getByRole('link', { name: first.label })
    await expect(firstLink).toBeVisible({ timeout: 5000 })

    for (const item of liveBranscher) {
      await expect(
        page.getByRole('link', { name: item.label })
      ).toHaveAttribute('href', item.route)
    }
  })

  test('Branscher: unpublished industries are NOT links', async ({ page }) => {
    test.skip(
      comingSoonBranscher.length === 0,
      'every industry page is published'
    )
    await page.getByRole('button', { name: 'Branscher' }).hover()
    // Positive guard first: the menu must actually be open before the
    // negative assertions below can mean anything.
    await expect(page.getByText(comingSoonBranscher[0]!.label)).toBeVisible({
      timeout: 5000,
    })

    for (const item of comingSoonBranscher) {
      await expect(page.getByRole('link', { name: item.label })).toHaveCount(0)
    }
  })

  test('Branscher: first published industry navigates to its live page', async ({
    page,
  }) => {
    test.skip(liveBranscher.length === 0, 'no published industry pages yet')
    const first = liveBranscher[0]!

    await page.getByRole('button', { name: 'Branscher' }).hover()
    await page.getByRole('link', { name: first.label }).click()

    await expect(page).toHaveURL(new RegExp(`${first.route}$`))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('Funktioner: published features are live links, rest are anchor fallbacks', async ({
    page,
  }) => {
    test.skip(liveFunktioner.length === 0, 'no published feature pages yet')
    await page.getByRole('button', { name: 'Funktioner' }).hover()

    const nav = page.getByRole('navigation').first()
    const first = liveFunktioner[0]!
    await expect(nav.getByRole('link', { name: first.label })).toBeVisible({
      timeout: 5000,
    })

    // Published feature pages: canonical route hrefs (the nav flip — AC 14).
    for (const item of liveFunktioner) {
      await expect(nav.getByRole('link', { name: item.label })).toHaveAttribute(
        'href',
        item.route
      )
    }
    // Unpublished feature items stay links, but to their homepage anchors —
    // never to the (unpublished) route and never "Kommer snart".
    for (const item of anchorFunktioner) {
      await expect(nav.getByRole('link', { name: item.label })).toHaveAttribute(
        'href',
        item.anchorFallback!
      )
    }
  })

  test('Funktioner: first published feature navigates to its live page', async ({
    page,
  }) => {
    test.skip(liveFunktioner.length === 0, 'no published feature pages yet')
    const first = liveFunktioner[0]!

    await page.getByRole('button', { name: 'Funktioner' }).hover()
    const nav = page.getByRole('navigation').first()
    await nav.getByRole('link', { name: first.label }).click()

    await expect(page).toHaveURL(new RegExp(`${first.route}$`))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('Områden: published topics are links, unpublished are not', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Områden' }).hover()
    // Scope to the desktop navigation: label substrings like "Arbetsmiljö"
    // and "Miljö" also occur in footer/body links — page-wide negative
    // assertions false-positive the moment such a page publishes.
    const nav = page.getByRole('navigation').first()
    await expect(nav.getByText(OMRADEN_NAV[0]!.label)).toBeVisible({
      timeout: 5000,
    })

    for (const item of liveOmraden) {
      await expect(nav.getByRole('link', { name: item.label })).toHaveAttribute(
        'href',
        item.route
      )
    }
    for (const item of comingSoonOmraden) {
      await expect(nav.getByRole('link', { name: item.label })).toHaveCount(0)
    }
  })
})
