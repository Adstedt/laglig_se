/**
 * Reproduce: Duplicate key warnings when paginating in grouped document list.
 *
 * Steps to reproduce:
 *   1. Log in, navigate to /laglistor
 *   2. Select the large arbetsmiljölista (106 entries)
 *   3. Switch to table (list) view
 *   4. Click "Visa fler" to load the next page
 *   5. Observe React console errors about duplicate keys
 */

import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'alexander.adstedt+10@kontorab.se'
const TEST_PASSWORD = 'KBty8611!!!!'

test.use({
  viewport: { width: 1920, height: 1080 },
})

test.describe('Duplicate key bug on pagination', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', TEST_EMAIL)
    await page.fill('input[name="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|laglistor)/, { timeout: 15000 })
  })

  test('should not produce duplicate key warnings when clicking Visa fler', async ({
    page,
  }) => {
    // Collect all console messages
    const consoleMessages: { type: string; text: string }[] = []
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() })
    })

    // Navigate to laglistor
    await page.goto('/laglistor')
    await page.waitForTimeout(3000)

    // Switch to the arbetsmiljö list — open the list switcher dropdown
    const listSwitcher = page.locator(
      'button[role="combobox"][aria-haspopup="menu"]'
    )
    await listSwitcher.click()
    await page.waitForTimeout(500)

    // Select the arbetsmiljö list (the one with 106 entries)
    const arbetsmiljoOption = page
      .locator('[role="menuitem"]')
      .filter({ hasText: /arbetsmiljö/i })
    await expect(arbetsmiljoOption.first()).toBeVisible({ timeout: 5000 })
    await arbetsmiljoOption.first().click()
    await page.waitForTimeout(3000)

    // Switch to table/list view
    const tableToggle = page.getByRole('radio', { name: /tabellvy/i })
    if ((await tableToggle.getAttribute('aria-checked')) !== 'true') {
      await tableToggle.click()
      await page.waitForTimeout(1000)
    }

    // Wait for table to render
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 })

    // Clear console messages collected during load — we only care about
    // messages that appear AFTER clicking "Visa fler".
    consoleMessages.length = 0

    // Find the "Visa fler" button (load more)
    const visaFlerButton = page.getByRole('button', { name: 'Visa fler' })
    await expect(visaFlerButton).toBeVisible({
      timeout: 5000,
    })

    // Click "Visa fler" to load page 2
    await visaFlerButton.click()

    // Wait for the new items to render
    await page.waitForTimeout(5000)

    // Check for duplicate-key warnings in console
    const duplicateKeyWarnings = consoleMessages.filter(
      (msg) =>
        msg.text.includes('Encountered two children with the same key') ||
        msg.text.includes('duplicate key')
    )

    // Log what we found for debugging
    if (duplicateKeyWarnings.length > 0) {
      console.log(
        `Found ${duplicateKeyWarnings.length} duplicate key warning(s):`
      )
      for (const w of duplicateKeyWarnings) {
        console.log(`  [${w.type}] ${w.text.substring(0, 300)}`)
      }
    } else {
      console.log('No duplicate key warnings found.')
    }

    // This assertion should FAIL if the bug exists
    expect(
      duplicateKeyWarnings,
      `Expected 0 duplicate key warnings but found ${duplicateKeyWarnings.length}`
    ).toHaveLength(0)
  })
})
