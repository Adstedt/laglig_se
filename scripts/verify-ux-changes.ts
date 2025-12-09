/* eslint-disable no-console */
import { chromium } from 'playwright'

async function verifyUxChanges() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })

  const url = 'http://localhost:3000/lagar/arbetsmiljolag-19771160-1977-1160'
  console.log('Navigating to:', url)

  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500) // Wait for JS to process

  // Screenshot 1: Verify § numbers are larger
  const paragraph1 = await page.$('a.paragraf')
  if (paragraph1) {
    await paragraph1.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await page.screenshot({
      path: 'screenshots/verify-1-paragraph-styling.png',
      fullPage: false
    })
    console.log('1. Paragraph styling screenshot saved')
  }

  // Screenshot 2: Check law references are clickable
  // Find a "Lag (YYYY:NNN)" text
  await page.evaluate(() => window.scrollTo(0, 2000))
  await page.waitForTimeout(500)
  await page.screenshot({
    path: 'screenshots/verify-2-law-references.png',
    fullPage: false
  })
  console.log('2. Law references screenshot saved')

  // Screenshot 3: Scroll to bottom to see both buttons
  await page.evaluate(() => window.scrollTo(0, 3000))
  await page.waitForTimeout(500)
  await page.screenshot({
    path: 'screenshots/verify-3-buttons.png',
    fullPage: false
  })
  console.log('3. Buttons (FAB + back-to-top) screenshot saved')

  // Screenshot 4: Check future amendment still works
  const futureAmendment = await page.$('.future-amendment-highlight')
  if (futureAmendment) {
    await futureAmendment.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'screenshots/verify-4-future-amendment.png',
      fullPage: false
    })
    console.log('4. Future amendment screenshot saved')
  }

  // Verify law reference links exist
  const lawLinks = await page.$$('a.law-reference-link')
  console.log(`\nFound ${lawLinks.length} law reference links`)

  // Check if § styling was applied
  const paragrafBold = await page.$('a.paragraf b')
  if (paragrafBold) {
    const style = await paragrafBold.evaluate(el => el.getAttribute('style'))
    console.log('§ bold style:', style ? 'Applied' : 'Not found')
  }

  await browser.close()
  console.log('\nDone! Screenshots saved to screenshots/verify-*.png')
}

verifyUxChanges().catch(console.error)
