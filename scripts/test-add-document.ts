/**
 * Test the add document to list functionality
 */

import { chromium } from 'playwright'

const TEST_EMAIL =
  process.env.TEST_USER_EMAIL || 'alexander.adstedt+10@kontorab.se'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'KBty8611!!!!'

async function testAddDocument() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  // Listen to console messages
  page.on('console', (msg) => {
    if (
      msg.text().includes('[') ||
      msg.text().includes('Add') ||
      msg.text().includes('error')
    ) {
      console.log('BROWSER LOG:', msg.text())
    }
  })

  try {
    // Login
    console.log('Logging in...')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="email"]', TEST_EMAIL)
    await page.fill('input[name="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/(dashboard|laglistor)/, { timeout: 15000 })
    console.log('Logged in successfully')

    // Navigate to laglistor
    console.log('Navigating to /laglistor...')
    await page.goto('http://localhost:3000/laglistor')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Check if we have a list selected
    const listSwitcher = page.locator(
      'button[role="combobox"][aria-haspopup="menu"]'
    )
    const listText = await listSwitcher.textContent()
    console.log('Current list:', listText)

    // Click add document button
    console.log('Opening add document modal...')
    const addButton = page.getByRole('button', { name: /Lägg till dokument/i })
    await addButton.click()
    await page.waitForTimeout(500)

    // Switch to browse tab (more predictable results)
    console.log('Switching to browse tab...')
    const browseTab = page.getByRole('tab', { name: /Bläddra/i })
    await browseTab.click()
    await page.waitForTimeout(1500) // Wait for browse results to load

    // Take screenshot before adding
    await page.screenshot({
      path: 'test-results/screenshots/add-doc-1-before.png',
      fullPage: false,
    })
    console.log('Screenshot: Before adding')

    // Click the first "Lägg till" button
    console.log('Clicking add button on first result...')
    const addDocButton = page
      .getByRole('button', { name: /Lägg till/i })
      .first()

    // Get the document title before adding
    const firstResult = page.locator('.flex.flex-col.gap-2 > div').first()
    const docTitle = await firstResult.locator('p.font-medium').textContent()
    console.log('Adding document:', docTitle)

    await addDocButton.click()
    await page.waitForTimeout(2000) // Wait for add action

    // Take screenshot after adding
    await page.screenshot({
      path: 'test-results/screenshots/add-doc-2-after.png',
      fullPage: false,
    })
    console.log('Screenshot: After adding')

    // Check if button changed to "Tillagt"
    const addedButton = page.getByRole('button', { name: /Tillagt/i }).first()
    const isAdded = await addedButton.isVisible().catch(() => false)
    console.log('Button shows "Tillagt":', isAdded)

    // Close modal
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Take screenshot of list
    await page.screenshot({
      path: 'test-results/screenshots/add-doc-3-list.png',
      fullPage: false,
    })
    console.log('Screenshot: Final list view')

    // Check if document appears in list
    const documentInList = page.getByText(docTitle?.slice(0, 30) || '')
    const docVisible = await documentInList.isVisible().catch(() => false)
    console.log('Document visible in list:', docVisible)

    console.log('\n=== Test Complete ===')
    console.log('Results saved to test-results/screenshots/')

    // Keep browser open for inspection
    console.log('\nBrowser will close in 10 seconds...')
    await page.waitForTimeout(10000)
  } catch (error) {
    console.error('Error:', error)
    await page.screenshot({
      path: 'test-results/screenshots/add-doc-error.png',
      fullPage: false,
    })
  } finally {
    await browser.close()
  }
}

testAddDocument()
