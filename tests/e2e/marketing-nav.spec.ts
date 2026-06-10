/**
 * E2E: Marketing megamenu (Story 26.2 / 26.4 AC 13)
 *
 * Closes QA-26.2-1 — the unit tests asserted nav state via the mobile sheet
 * (Radix hover menus are flaky in happy-dom); this proves the DESKTOP
 * NavigationMenu opens on hover, published industries are live links, and
 * unpublished ones render as non-link "Kommer snart" items.
 */
import { test, expect } from '@playwright/test'

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
    await page.getByRole('button', { name: 'Branscher' }).hover()

    const bygg = page.getByRole('link', { name: /Bygg & anläggning/ })
    await expect(bygg).toBeVisible({ timeout: 5000 })
    await expect(bygg).toHaveAttribute('href', '/branscher/bygg')

    await expect(
      page.getByRole('link', { name: /Restaurang & hotell/ })
    ).toHaveAttribute('href', '/branscher/hotell-restaurang')
    await expect(page.getByRole('link', { name: /IT & tech/ })).toHaveAttribute(
      'href',
      '/branscher/it'
    )
  })

  test('Branscher: an unpublished industry is NOT a link', async ({ page }) => {
    await page.getByRole('button', { name: 'Branscher' }).hover()
    await expect(
      page.getByRole('link', { name: /Bygg & anläggning/ })
    ).toBeVisible({ timeout: 5000 })

    // Vård & omsorg has no page yet → coming-soon, not a link
    await expect(page.getByRole('link', { name: /Vård & omsorg/ })).toHaveCount(
      0
    )
  })

  test('Branscher → Bygg navigates to the live page', async ({ page }) => {
    await page.getByRole('button', { name: 'Branscher' }).hover()
    await page.getByRole('link', { name: /Bygg & anläggning/ }).click()

    await expect(page).toHaveURL(/\/branscher\/bygg$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/bygg/i)
  })

  test('Områden: topics render but none are live links yet', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Områden' }).hover()
    await expect(page.getByText('GDPR & dataskydd')).toBeVisible({
      timeout: 5000,
    })
    // No /omraden/* content shipped → no live links into /omraden
    await expect(
      page.getByRole('link', { name: /GDPR & dataskydd/ })
    ).toHaveCount(0)
  })
})
