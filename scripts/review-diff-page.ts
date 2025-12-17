/**
 * Use Playwright to review the diff page and verify content
 */
import { chromium } from 'playwright'

async function main() {
  console.log('Launching browser to review diff page...\n')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto(
    'http://localhost:3000/lagar/arbetsmiljolag-19771160-1977-1160/historik?from=2000-01-01&to=2028-07-01'
  )

  // Wait for the page to load
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  console.log('=== PAGE REVIEW ===\n')

  // Get summary stats from the page
  const summaryText = await page
    .locator('text=/\\+\\d+ tillagda/')
    .first()
    .textContent()
    .catch(() => null)
  const removedText = await page
    .locator('text=/\\d+ upphävda/')
    .first()
    .textContent()
    .catch(() => null)
  const changedText = await page
    .locator('text=/\\d+ ändrade/')
    .first()
    .textContent()
    .catch(() => null)

  console.log('Summary badges found:')
  console.log(`  Added: ${summaryText}`)
  console.log(`  Removed: ${removedText}`)
  console.log(`  Changed: ${changedText}`)

  // Find all section cards/accordions
  const sectionCards = await page
    .locator('[class*="accordion"], [class*="card"], [class*="section"]')
    .all()
  console.log(`\nTotal section elements found: ${sectionCards.length}`)

  // Look for specific patterns
  const addedSections = await page.locator('text=/Tillagd/i').all()
  const removedSections = await page.locator('text=/Upphävd/i').all()
  const changedSections = await page.locator('text=/Ändrad/i').all()

  console.log(`\nSection badges:`)
  console.log(`  "Tillagd" (Added): ${addedSections.length}`)
  console.log(`  "Upphävd" (Removed): ${removedSections.length}`)
  console.log(`  "Ändrad" (Changed): ${changedSections.length}`)

  // Find sections with "+0 / -0 rader" (empty changes)
  const emptyChanges = await page.locator('text=/\\+0.*-0 rader/').all()
  console.log(`  Empty changes (+0/-0): ${emptyChanges.length}`)

  // Click on each accordion to expand and check content
  console.log('\n=== EXPANDING ALL ACCORDIONS ===\n')

  // Find all expandable items (look for chevron or expand buttons)
  const expandButtons = await page
    .locator('button[class*="accordion"], [role="button"][aria-expanded]')
    .all()
  console.log(`Found ${expandButtons.length} expandable items`)

  // Try clicking on section headers to expand
  const _sectionHeaders = await page.locator('[class*="kap"]').all()

  let sectionsWithContent = 0
  let sectionsWithoutContent = 0
  const emptyList: string[] = []
  const contentList: string[] = []

  // Get all the section items by looking for the kap pattern
  const allSectionItems = await page
    .locator('text=/\\d+ kap\\. \\d+[a-z]? §/')
    .all()
  console.log(`\nFound ${allSectionItems.length} section references`)

  // Try a different approach - find all accordion triggers
  const accordionTriggers = await page.locator('[data-state]').all()
  console.log(`Found ${accordionTriggers.length} accordion triggers`)

  // Look for actual diff content
  const diffLines = await page
    .locator('[class*="diff"], [class*="added"], [class*="removed"]')
    .all()
  console.log(`Found ${diffLines.length} diff-related elements`)

  // Check for text that indicates unavailable content
  const unavailableText = await page
    .locator('text=/text.*unavailable|ingen.*text|saknas/i')
    .all()
  console.log(`Found ${unavailableText.length} "unavailable" indicators`)

  // Let's look at the actual HTML structure
  console.log('\n=== ANALYZING PAGE STRUCTURE ===\n')

  // Get all visible text content that looks like section changes
  const pageContent = await page.content()

  // Count occurrences of key patterns
  const addedPattern = (pageContent.match(/Tillagd/g) || []).length
  const removedPattern = (pageContent.match(/Upphävd/g) || []).length
  const changedPattern = (pageContent.match(/Ändrad/g) || []).length
  const zeroChanges = (pageContent.match(/\+0\s*\/\s*-0/g) || []).length

  console.log('Pattern counts in HTML:')
  console.log(`  "Tillagd": ${addedPattern}`)
  console.log(`  "Upphävd": ${removedPattern}`)
  console.log(`  "Ändrad": ${changedPattern}`)
  console.log(`  "+0 / -0": ${zeroChanges}`)

  // Now let's try to click and expand each section to see what's inside
  console.log('\n=== CHECKING INDIVIDUAL SECTIONS ===\n')

  // Find all clickable section headers
  const clickableHeaders = await page.locator('button:has-text("kap")').all()
  console.log(`Found ${clickableHeaders.length} clickable section headers`)

  // Sample a few sections to check their content
  const sampleSize = Math.min(10, clickableHeaders.length)
  console.log(`\nSampling ${sampleSize} sections:\n`)

  for (let i = 0; i < sampleSize; i++) {
    try {
      const header = clickableHeaders[i]
      const headerText = await header.textContent()

      // Click to expand
      await header.click()
      await page.waitForTimeout(300)

      // Check if there's actual diff content visible
      const expandedContent = await page
        .locator('[data-state="open"]')
        .first()
        .textContent()
        .catch(() => '')

      const hasContent =
        expandedContent &&
        expandedContent.length > 100 &&
        !expandedContent.includes('+0 / -0')

      if (hasContent) {
        sectionsWithContent++
        contentList.push(headerText?.trim() || `Section ${i}`)
        console.log(`  ✓ ${headerText?.substring(0, 40)} - HAS CONTENT`)
      } else {
        sectionsWithoutContent++
        emptyList.push(headerText?.trim() || `Section ${i}`)
        console.log(`  ✗ ${headerText?.substring(0, 40)} - EMPTY/MINIMAL`)
      }

      // Click again to collapse
      await header.click()
      await page.waitForTimeout(100)
    } catch (e) {
      console.log(`  ? Error checking section ${i}`)
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60))
  console.log('FINAL SUMMARY')
  console.log('='.repeat(60))
  console.log(
    `\nTotal sections in diff: ${addedPattern + removedPattern + changedPattern}`
  )
  console.log(`  - Added (Tillagd): ${addedPattern}`)
  console.log(`  - Removed (Upphävd): ${removedPattern}`)
  console.log(`  - Changed (Ändrad): ${changedPattern}`)
  console.log(`\nEmpty changes (+0/-0 rader): ${zeroChanges}`)
  console.log(
    `Percentage empty: ${((zeroChanges / changedPattern) * 100).toFixed(1)}%`
  )

  console.log(`\nFrom sample of ${sampleSize} sections:`)
  console.log(`  With actual content: ${sectionsWithContent}`)
  console.log(`  Empty/minimal: ${sectionsWithoutContent}`)

  await browser.close()
}

main().catch(console.error)
