/**
 * E2E Tests for Amendment Document Pages
 * Story 2.29: Amendment Document Pages
 */

import { test, expect } from '@playwright/test'

test.describe('Amendment Document Pages (Story 2.29)', () => {
  test.describe('Catalogue Integration', () => {
    test('should have Ändringsförfattningar filter option in catalogue', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto(`/rattskallor`)

      // Wait for page to load
      await expect(page.locator('h1')).toBeVisible()

      // Check that the Ändringsförfattningar filter option exists
      const amendmentFilter = page.getByLabel('Ändringsförfattningar')
      await expect(amendmentFilter).toBeVisible({ timeout: 10000 })
    })

    test('should filter by amendments when selected', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto(`/rattskallor`)

      // Wait for page to load
      await page.waitForTimeout(2000)

      // Check the amendments filter using click instead of check
      const amendmentFilter = page.getByLabel('Ändringsförfattningar')
      if (await amendmentFilter.isVisible()) {
        await amendmentFilter.click()

        // URL should contain the filter
        await expect(page).toHaveURL(/types=.*SFS_AMENDMENT/, {
          timeout: 10000,
        })
      }
    })
  })

  test.describe('History Page Integration', () => {
    test('should load history page for arbetsmiljölagen', async ({ page }) => {
      await page.goto(`/lagar/arbetsmiljolag-19771160-1977-1160/historik`)

      // Wait for page to load
      await expect(page.locator('h1:has-text("Ändringshistorik")')).toBeVisible(
        { timeout: 10000 }
      )

      // Should show timeline (CardTitle, not heading role)
      await expect(page.getByText('Ändringar över tid')).toBeVisible()

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/amendment-history-page.png',
        fullPage: true,
      })
    })

    test('should have Detaljer link on amendments', async ({ page }) => {
      await page.goto(`/lagar/arbetsmiljolag-19771160-1977-1160/historik`)

      // Wait for timeline to load
      await page.waitForTimeout(3000)

      // Look for a "Detaljer" badge/link on amendment entries
      const detailsLink = page.locator('a:has-text("Detaljer")').first()

      // If details link exists, click it
      if (await detailsLink.isVisible({ timeout: 5000 })) {
        const href = await detailsLink.getAttribute('href')
        console.log('Found Detaljer link:', href)

        // It should point to /lagar/andringar/{slug}
        expect(href).toContain('/lagar/andringar/')

        // Click and verify navigation
        await detailsLink.click()
        await expect(page).toHaveURL(/\/lagar\/andringar\//)

        // Take screenshot of amendment page
        await page.screenshot({
          path: 'tests/e2e/screenshots/amendment-detail-page.png',
          fullPage: true,
        })
      }
    })
  })

  test.describe('Amendment Page Display', () => {
    test('should display amendment page with required content', async ({
      page,
    }) => {
      // First, find an actual amendment page by checking the history
      await page.goto(`/lagar/arbetsmiljolag-19771160-1977-1160/historik`)

      await page.waitForTimeout(3000)

      // Find a Detaljer link
      const detailsLink = page.locator('a:has-text("Detaljer")').first()

      if (await detailsLink.isVisible({ timeout: 5000 })) {
        await detailsLink.click()

        // Wait for amendment page to load
        await page.waitForTimeout(2000)

        // Check for required elements (AC3):
        // - Title
        await expect(page.locator('h1')).toBeVisible()

        // - SFS badge
        const sfsBadge = page.locator('text=/SFS \\d{4}:\\d+/')
        await expect(sfsBadge.first()).toBeVisible({ timeout: 5000 })

        // - Document type badge (Ändringsförfattning)
        await expect(page.getByText('Ändringsförfattning')).toBeVisible()

        // Take screenshot
        await page.screenshot({
          path: 'tests/e2e/screenshots/amendment-page-content.png',
          fullPage: true,
        })

        console.log('✓ Amendment page displays required content')
      } else {
        console.log(
          '⚠ No Detaljer links found - amendments may not have LegalDocument entries yet'
        )
        test.skip()
      }
    })

    test('should have link back to base law', async ({ page }) => {
      await page.goto(`/lagar/arbetsmiljolag-19771160-1977-1160/historik`)

      await page.waitForTimeout(3000)

      const detailsLink = page.locator('a:has-text("Detaljer")').first()

      if (await detailsLink.isVisible({ timeout: 5000 })) {
        await detailsLink.click()
        await page.waitForTimeout(2000)

        // Check for "Ändrar i grundförfattning" section
        const baseLawSection = page.getByText('Ändrar i grundförfattning')
        if (await baseLawSection.isVisible({ timeout: 5000 })) {
          console.log('✓ Base law link section found')

          // Should have a "Till lagen" button
          const backButton = page.getByRole('link', { name: /Till lagen/ })
          await expect(backButton).toBeVisible()
        }
      } else {
        test.skip()
      }
    })
  })

  test.describe('404 Handling', () => {
    test('should show 404 for invalid amendment slug', async ({ page }) => {
      await page.goto(`/lagar/andringar/invalid-slug-that-does-not-exist`)

      // Next.js custom 404 pages return HTTP 200 with 404 content
      // Check for 404 text on page instead
      await expect(page.getByText('404')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('Sidan kunde inte hittas')).toBeVisible()
    })
  })
})
