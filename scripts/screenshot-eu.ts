import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  // Go to EU regulations listing
  await page.goto('http://localhost:3000/eu/forordningar')
  await page.waitForLoadState('networkidle')

  // Find first document link and get its href
  const firstLink = page.locator('a[href^="/eu/forordningar/"]').first()
  if ((await firstLink.count()) > 0) {
    const href = await firstLink.getAttribute('href')
    console.log('Found link:', href)

    // Navigate directly to the detail page
    await page.goto(`http://localhost:3000${href}`)
    await page.waitForLoadState('networkidle')

    // Take screenshot
    await page.screenshot({ path: 'screenshot-eu-detail.png', fullPage: true })
    console.log('Screenshot saved to screenshot-eu-detail.png')
  } else {
    console.log('No EU documents found')
  }

  await browser.close()
}

main()
