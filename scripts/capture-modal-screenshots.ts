/**
 * Capture screenshots of the Add Document Modal for UX review
 */

import { chromium } from 'playwright'

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'alexander.adstedt+10@kontorab.se'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'KBty8611!!!!'

async function captureModalScreenshots() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

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

    // Take screenshot of page
    await page.screenshot({ path: 'test-results/screenshots/modal-1-page.png', fullPage: false })
    console.log('Screenshot 1: Page captured')

    // Click add document button
    const addButton = page.getByRole('button', { name: /Lägg till dokument/i })
    await addButton.click()
    await page.waitForTimeout(500)

    // Take screenshot of empty modal (search tab)
    await page.screenshot({ path: 'test-results/screenshots/modal-2-empty-search.png', fullPage: false })
    console.log('Screenshot 2: Empty search tab captured')

    // Type search query
    const searchInput = page.getByPlaceholder(/Sök på titel/i)
    await searchInput.fill('lag')
    await page.waitForTimeout(1000) // Wait for debounced search

    // Take screenshot of search results
    await page.screenshot({ path: 'test-results/screenshots/modal-3-search-results.png', fullPage: false })
    console.log('Screenshot 3: Search results captured')

    // Search for longer title
    await searchInput.fill('arbetsmiljö')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/screenshots/modal-4-long-titles.png', fullPage: false })
    console.log('Screenshot 4: Long titles captured')

    // Click Browse tab
    const browseTab = page.getByRole('tab', { name: /Bläddra/i })
    await browseTab.click()
    await page.waitForTimeout(1500) // Wait for browse results to load

    // Take screenshot of browse tab
    await page.screenshot({ path: 'test-results/screenshots/modal-5-browse-tab.png', fullPage: false })
    console.log('Screenshot 5: Browse tab captured')

    // Click different category
    const courtCasesButton = page.getByRole('button', { name: 'Rättsfall' })
    await courtCasesButton.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'test-results/screenshots/modal-6-browse-court-cases.png', fullPage: false })
    console.log('Screenshot 6: Court cases browse captured')

    console.log('\nAll screenshots saved to test-results/screenshots/')
    console.log('Review them to assess modal UX')

    // Keep browser open for manual inspection
    console.log('\nBrowser will close in 10 seconds...')
    await page.waitForTimeout(10000)

  } catch (error) {
    console.error('Error:', error)
    await page.screenshot({ path: 'test-results/screenshots/modal-error.png', fullPage: false })
  } finally {
    await browser.close()
  }
}

captureModalScreenshots()
