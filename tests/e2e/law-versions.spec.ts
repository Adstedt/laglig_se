/**
 * E2E Tests for Law Historical Versions Functionality
 * Story 2.13 - Tests for VersionSelector, history page, and diff comparison
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const TEST_LAW_SLUG = 'arbetsmiljolag-19771160-1977-1160'
const TEST_LAW_SFS = '1977:1160'

test.describe('Law Historical Versions', () => {
  test.describe('Version Selector', () => {
    test('should display version selector on law page', async ({ page }) => {
      await page.goto(`${BASE_URL}/lagar/${TEST_LAW_SLUG}`)

      // Wait for the page to load
      await expect(page.locator('h1')).toBeVisible()

      // Version selector should be visible (after amendments load)
      const versionSelector = page.locator(
        'button:has-text("Gällande version"), button:has-text("Välj version")'
      )
      await expect(versionSelector).toBeVisible({ timeout: 10000 })
    })

    test('should show amendment history in dropdown', async ({ page }) => {
      await page.goto(`${BASE_URL}/lagar/${TEST_LAW_SLUG}`)

      // Wait for version selector to load
      await page.waitForTimeout(2000) // Give time for API fetch

      // Click the version selector
      const selector = page.locator(
        '[data-radix-select-trigger], button:has-text("Gällande version")'
      )
      await selector.click()

      // Should show "Tidigare versioner" section
      await expect(page.getByText('Tidigare versioner')).toBeVisible({
        timeout: 5000,
      })
    })

    test('should navigate to historical version when selecting a date', async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/lagar/${TEST_LAW_SLUG}`)

      // Wait for version selector
      await page.waitForTimeout(2000)

      // Click selector
      const selector = page.locator(
        '[data-radix-select-trigger], button:has-text("Gällande version")'
      )
      await selector.click()

      // Click on "Visa alla X versioner..." to go to history
      const showAllLink = page.getByText(/Visa alla.*versioner/)
      if (await showAllLink.isVisible()) {
        await showAllLink.click()
        await expect(page).toHaveURL(
          new RegExp(`/lagar/${TEST_LAW_SLUG}/historik`)
        )
      }
    })
  })

  test.describe('History Page', () => {
    test('should load history page with amendments', async ({ page }) => {
      await page.goto(`${BASE_URL}/lagar/${TEST_LAW_SLUG}/historik`)

      // Wait for page to load
      await expect(
        page.locator('h1:has-text("Ändringshistorik")')
      ).toBeVisible()

      // Should show amendment count
      await expect(page.getByText(/\d+ ändringar/)).toBeVisible()

      // Should show "Jämför versioner" section
      await expect(page.getByText('Jämför versioner')).toBeVisible()

      // Should show "Tidslinje över ändringar"
      await expect(page.getByText('Tidslinje över ändringar')).toBeVisible()
    })

    test('should display available version dates', async ({ page }) => {
      await page.goto(`${BASE_URL}/lagar/${TEST_LAW_SLUG}/historik`)

      // Wait for content to load
      await page.waitForTimeout(2000)

      // Should have "Tillgängliga versioner" section
      await expect(page.getByText('Tillgängliga versioner')).toBeVisible({
        timeout: 10000,
      })
    })
  })

  test.describe('Version Comparison', () => {
    test('should have compare form with date inputs', async ({ page }) => {
      await page.goto(`${BASE_URL}/lagar/${TEST_LAW_SLUG}/historik`)

      // Should have from and to date inputs
      await expect(page.locator('#from-date')).toBeVisible()
      await expect(page.locator('#to-date')).toBeVisible()

      // Should have compare button
      await expect(page.getByRole('button', { name: /Jämför/ })).toBeVisible()
    })

    test('should submit comparison and show diff', async ({ page }) => {
      // Go to history page with comparison params
      const fromDate = '2020-01-01'
      const toDate = '2025-01-01'

      await page.goto(
        `${BASE_URL}/lagar/${TEST_LAW_SLUG}/historik?from=${fromDate}&to=${toDate}`
      )

      // Wait for diff to load
      await page.waitForTimeout(3000)

      // Should show diff header with dates
      const diffHeader = page.getByText(/Ändringar.*till/)
      await expect(diffHeader).toBeVisible({ timeout: 10000 })

      // Take screenshot for analysis
      await page.screenshot({
        path: 'tests/e2e/screenshots/comparison-result.png',
        fullPage: true,
      })
    })

    test('should display section changes in diff', async ({ page }) => {
      const fromDate = '2020-01-01'
      const toDate = '2025-01-01'

      await page.goto(
        `${BASE_URL}/lagar/${TEST_LAW_SLUG}/historik?from=${fromDate}&to=${toDate}`
      )

      await page.waitForTimeout(3000)

      // Look for section badges (Tillagd, Upphävd, Ändrad)
      const addedBadges = page.locator('text=tillagda')
      const removedBadges = page.locator('text=upphävda')
      const modifiedBadges = page.locator('text=ändrade')

      // At least one type of change should be visible (or no changes message)
      const hasChanges =
        (await addedBadges.count()) > 0 ||
        (await removedBadges.count()) > 0 ||
        (await modifiedBadges.count()) > 0

      const noChangesMessage = page.getByText('Inga ändringar att visa')
      const hasNoChanges = await noChangesMessage.isVisible().catch(() => false)

      expect(hasChanges || hasNoChanges).toBe(true)
    })

    test('should expand section to show diff content', async ({ page }) => {
      const fromDate = '2020-01-01'
      const toDate = '2025-01-01'

      await page.goto(
        `${BASE_URL}/lagar/${TEST_LAW_SLUG}/historik?from=${fromDate}&to=${toDate}`
      )

      await page.waitForTimeout(3000)

      // Click on first expandable section
      const sectionButton = page.locator('button:has-text("§")').first()

      if (await sectionButton.isVisible()) {
        await sectionButton.click()

        // Take screenshot of expanded section
        await page.screenshot({
          path: 'tests/e2e/screenshots/expanded-section.png',
          fullPage: true,
        })

        // Check if content is visible (should have text content)
        const expandedContent = page.locator(
          '.bg-muted\\/20, .whitespace-pre-wrap'
        )
        await expect(expandedContent.first()).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe('Historical Version Page', () => {
    test('should load historical version at specific date', async ({
      page,
    }) => {
      // Pick a date we know has data
      const testDate = '2024-01-01'

      await page.goto(`${BASE_URL}/lagar/${TEST_LAW_SLUG}/version/${testDate}`)

      // Wait for page to load
      await page.waitForTimeout(3000)

      // Take screenshot
      await page.screenshot({
        path: 'tests/e2e/screenshots/historical-version.png',
        fullPage: true,
      })

      // Check if we got the historical version banner
      const historicalBanner = page.getByText('Du visar en historisk version')
      await expect(historicalBanner).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('API Endpoints', () => {
    test('history API should return valid data', async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/laws/${encodeURIComponent(TEST_LAW_SFS)}/history`
      )

      expect(response.ok()).toBe(true)

      const data = await response.json()
      console.log(
        'History API response:',
        JSON.stringify(data, null, 2).substring(0, 500)
      )

      expect(data).toHaveProperty('baseLawSfs')
      expect(data).toHaveProperty('amendments')
      expect(data).toHaveProperty('availableVersionDates')
    })

    test('diff API should return valid data', async ({ request }) => {
      const fromDate = '2020-01-01'
      const toDate = '2025-01-01'

      const response = await request.get(
        `${BASE_URL}/api/laws/${encodeURIComponent(TEST_LAW_SFS)}/diff?from=${fromDate}&to=${toDate}`
      )

      expect(response.ok()).toBe(true)

      const data = await response.json()
      console.log(
        'Diff API response:',
        JSON.stringify(data, null, 2).substring(0, 1000)
      )

      expect(data).toHaveProperty('baseLawSfs')
      expect(data).toHaveProperty('sections')

      // Check if sections have the expected structure
      if (data.sections && data.sections.length > 0) {
        const firstSection = data.sections[0]
        expect(firstSection).toHaveProperty('changeType')

        // Log a modified section for debugging
        const modifiedSection = data.sections.find(
          (s: { changeType: string }) => s.changeType === 'modified'
        )
        if (modifiedSection) {
          console.log(
            'Modified section example:',
            JSON.stringify(modifiedSection, null, 2)
          )
        }
      }
    })

    test('version API should return reconstructed law', async ({ request }) => {
      const testDate = '2024-01-01'

      const response = await request.get(
        `${BASE_URL}/api/laws/${encodeURIComponent(TEST_LAW_SFS)}/version/${testDate}`
      )

      expect(response.ok()).toBe(true)

      const data = await response.json()
      console.log(
        'Version API response (summary):',
        JSON.stringify(
          {
            baseLawSfs: data.baseLawSfs,
            asOfDate: data.asOfDate,
            title: data.title,
            sectionCount: data.sections?.length,
            meta: data.meta,
          },
          null,
          2
        )
      )

      expect(data).toHaveProperty('baseLawSfs')
      expect(data).toHaveProperty('sections')
      expect(Array.isArray(data.sections)).toBe(true)
    })
  })
})
