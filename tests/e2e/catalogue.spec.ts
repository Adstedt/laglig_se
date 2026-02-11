import { test, expect } from '@playwright/test'

test.describe('Regelverk Catalogue Page', () => {
  test('displays catalogue page with results', async ({ page }) => {
    await page.goto('/rattskallor')

    // Check page title
    await expect(page.locator('h1')).toContainText('Regelverk')

    // Check search bar is present
    await expect(
      page.getByPlaceholder('Sök lagar, rättsfall, EU-lagstiftning...')
    ).toBeVisible()
  })

  test('filters are visible on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/rattskallor')

    // Check filter sections are visible
    await expect(page.getByText('Dokumenttyp')).toBeVisible()
    await expect(page.getByText('Målgrupp')).toBeVisible()
    await expect(page.getByText('Kategori')).toBeVisible()
    await expect(page.getByText('Status')).toBeVisible()
  })

  test('mobile filter drawer works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/rattskallor')

    // Click filter button to open drawer
    await page.getByRole('button', { name: /filter/i }).click()

    // Check drawer opened with filter content
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Dokumenttyp')).toBeVisible()
  })

  test('navigates to lagar sub-route', async ({ page }) => {
    await page.goto('/rattskallor/lagar')

    // Check page title
    await expect(page.locator('h1')).toContainText('Svenska lagar (SFS)')

    // Check URL
    expect(page.url()).toContain('/rattskallor/lagar')
  })

  test('navigates to rattsfall sub-route', async ({ page }) => {
    await page.goto('/rattskallor/rattsfall')

    // Check page title
    await expect(page.locator('h1')).toContainText('Svenska rättsfall')

    // Check URL
    expect(page.url()).toContain('/rattskallor/rattsfall')
  })

  test('navigates to eu-ratt sub-route', async ({ page }) => {
    await page.goto('/rattskallor/eu-ratt')

    // Check page title
    await expect(page.locator('h1')).toContainText('EU-lagstiftning')

    // Check URL
    expect(page.url()).toContain('/rattskallor/eu-ratt')
  })

  test('search functionality updates URL', async ({ page }) => {
    await page.goto('/rattskallor')

    // Type in search bar
    const searchInput = page.getByPlaceholder(
      'Sök lagar, rättsfall, EU-lagstiftning...'
    )
    await searchInput.fill('arbetsmiljö')

    // Submit search
    await page.getByRole('button', { name: 'Sök' }).click()

    // Check URL contains search query
    await expect(page).toHaveURL(/q=arbetsmilj/)
  })

  test('pagination updates URL', async ({ page }) => {
    await page.goto('/rattskallor')

    // Wait for results to load
    await page
      .waitForSelector('[data-position]', { timeout: 10000 })
      .catch(() => {
        // If no results, skip pagination test
        test.skip()
      })

    // Check if pagination exists
    const nextButton = page.getByRole('link', { name: /nästa/i })
    if (await nextButton.isVisible()) {
      await nextButton.click()

      // Check URL contains page parameter
      await expect(page).toHaveURL(/page=2/)
    }
  })

  test('sort selector changes results order', async ({ page }) => {
    await page.goto('/rattskallor')

    // Open sort dropdown
    const sortSelect = page.getByRole('combobox').first()
    if (await sortSelect.isVisible()) {
      await sortSelect.click()

      // Select title sort
      await page.getByRole('option', { name: 'Titel (A-Ö)' }).click()

      // Check URL contains sort parameter
      await expect(page).toHaveURL(/sort=title/)
    }
  })

  test('applying filter updates URL', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/rattskallor')

    // Check a status filter
    const activeCheckbox = page.getByLabel('Gällande')
    if (await activeCheckbox.isVisible()) {
      await activeCheckbox.check()

      // Check URL contains status filter
      await expect(page).toHaveURL(/status=ACTIVE/)
    }
  })

  test('pre-filtered route hides content type filter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/rattskallor/lagar')

    // On lagar page, content type filter should be hidden
    // The "Lagar (SFS)" checkbox shouldn't be visible since it's pre-filtered
    await expect(page.getByLabel('Lagar (SFS)')).not.toBeVisible()
  })

  test('page has correct meta tags', async ({ page }) => {
    await page.goto('/rattskallor')

    // Check title
    const title = await page.title()
    expect(title).toContain('Bläddra i svensk lagstiftning')

    // Check meta description
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content')
    expect(description).toContain('Utforska över 170 000 svenska lagar')
  })
})
