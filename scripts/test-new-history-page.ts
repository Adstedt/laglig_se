/**
 * Test the new version-by-version history page
 */
import { chromium } from 'playwright'

async function main() {
  console.log('Testing new version-by-version history page...\n')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Navigate to the history page
  console.log('Loading history page...')
  await page.goto(
    'http://localhost:3000/lagar/arbetsmiljolag-19771160-1977-1160/historik'
  )
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  console.log('\n=== PAGE STRUCTURE ===\n')

  // Check for the info banner
  const infoBanner = await page.locator('text=Version för version').count()
  console.log(`Info banner found: ${infoBanner > 0 ? 'YES' : 'NO'}`)

  // Check for the timeline
  const timelineCard = await page.locator('text=Ändringar över tid').count()
  console.log(`Timeline card found: ${timelineCard > 0 ? 'YES' : 'NO'}`)

  // Count amendments in the timeline
  const amendmentItems = await page.locator('text=/SFS \\d{4}:\\d+/').all()
  console.log(`Amendment items found: ${amendmentItems.length}`)

  // Check for "Gällande version" header
  const currentVersion = await page.locator('text=Gällande version').count()
  console.log(`"Gällande version" header: ${currentVersion > 0 ? 'YES' : 'NO'}`)

  // Check for "Senaste" badge
  const senasteBadge = await page.locator('text=Senaste').count()
  console.log(`"Senaste" badge: ${senasteBadge > 0 ? 'YES' : 'NO'}`)

  console.log('\n=== TESTING EXPANDABLE AMENDMENTS ===\n')

  // Find clickable amendment items
  const clickableAmendments = await page
    .locator('[class*="cursor-pointer"], button:has-text("SFS")')
    .all()
  console.log(`Clickable amendment items: ${clickableAmendments.length}`)

  // Try to click on the first amendment to expand it
  if (amendmentItems.length > 0) {
    console.log('\nClicking on first amendment to expand...')

    // Find the first SFS badge to click - look for the clickable row
    const firstAmendmentRow = await page.locator('text=SFS 2024').first()
    const rowText = await firstAmendmentRow.textContent().catch(() => 'N/A')
    console.log(`Found row: ${rowText?.substring(0, 50)}`)

    // Click the parent element (the timeline item)
    await firstSfs.click()
    await page.waitForTimeout(1500)

    // Check if loading indicator appears
    const loadingIndicator = await page.locator('text=Laddar ändringar').count()
    console.log(
      `Loading indicator shown: ${loadingIndicator > 0 ? 'YES' : 'NO'}`
    )

    // Wait for content to load
    await page.waitForTimeout(2000)

    // Check for expanded content
    const expandedContent = await page.locator('text=/Ändringar från/').count()
    console.log(
      `Expanded content visible: ${expandedContent > 0 ? 'YES' : 'NO'}`
    )

    // Check for section cards
    const sectionCards = await page.locator('[class*="border-l-4"]').all()
    console.log(`Section cards visible: ${sectionCards.length}`)

    // Check for different change types
    const added = await page.locator('text=Tillagd').all()
    const removed = await page.locator('text=Upphävd').all()
    const modified = await page.locator('text=Ändrad').all()

    console.log(`\nChange types in expanded view:`)
    console.log(`  Tillagd (Added): ${added.length}`)
    console.log(`  Upphävd (Removed): ${removed.length}`)
    console.log(`  Ändrad (Modified): ${modified.length}`)

    // Check for "text saknas" indicators
    const textMissing = await page.locator('text=text saknas').all()
    console.log(`  "text saknas" indicators: ${textMissing.length}`)
  }

  // Check for "Hoppa till version" section
  const jumpToVersion = await page.locator('text=Hoppa till version').count()
  console.log(
    `\n"Hoppa till version" section: ${jumpToVersion > 0 ? 'YES' : 'NO'}`
  )

  // Take a screenshot
  await page.screenshot({
    path: 'test-results/new-history-page.png',
    fullPage: true,
  })
  console.log('\nScreenshot saved to test-results/new-history-page.png')

  await browser.close()

  console.log('\n=== TEST COMPLETE ===')
}

main().catch(console.error)
