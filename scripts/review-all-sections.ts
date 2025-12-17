/**
 * Sample ALL sections on the diff page to get complete picture
 */
import { chromium } from 'playwright'

async function main() {
  console.log('Launching browser to review ALL sections...\n')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.goto(
    'http://localhost:3000/lagar/arbetsmiljolag-19771160-1977-1160/historik?from=2000-01-01&to=2028-07-01'
  )

  // Wait for the page to load
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // Get all section items from the accordion
  const sectionItems = await page.locator('[data-state]').all()
  console.log(`Found ${sectionItems.length} accordion items\n`)

  // Collect all section data by evaluating in browser
  const sectionData = await page.evaluate(() => {
    const results: {
      id: string
      text: string
      badge: string
      lineInfo: string
      hasContent: boolean
    }[] = []

    // Find all accordion items or section cards
    const buttons = document.querySelectorAll('button')

    buttons.forEach((btn) => {
      const text = btn.textContent || ''
      // Check if this looks like a section reference (has "kap." and "§")
      if (text.includes('kap.') && text.includes('§')) {
        // Extract the badge type
        let badge = 'unknown'
        if (text.includes('Tillagd')) badge = 'added'
        else if (text.includes('Upphävd')) badge = 'removed'
        else if (text.includes('Ändrad')) badge = 'changed'

        // Extract line info
        const lineMatch = text.match(/([+-]\d+)\s*\/\s*([+-]?\d+)\s*rader/)
        const lineInfo = lineMatch
          ? `${lineMatch[1]}/${lineMatch[2]}`
          : 'no-line-info'

        // Check if it has actual content (non-zero lines)
        const hasContent = lineMatch
          ? parseInt(lineMatch[1]) !== 0 || parseInt(lineMatch[2]) !== 0
          : badge === 'added' || badge === 'removed'

        // Extract section ID
        const sectionMatch = text.match(/(\d+)\s*kap\.\s*(\d+[a-z]?)\s*§/)
        const id = sectionMatch
          ? `${sectionMatch[1]} kap. ${sectionMatch[2]} §`
          : text.substring(0, 30)

        results.push({
          id,
          text: text.substring(0, 80),
          badge,
          lineInfo,
          hasContent,
        })
      }
    })

    return results
  })

  console.log(`=== ALL ${sectionData.length} SECTIONS ===\n`)

  // Group by badge type
  const added = sectionData.filter((s) => s.badge === 'added')
  const removed = sectionData.filter((s) => s.badge === 'removed')
  const changed = sectionData.filter((s) => s.badge === 'changed')

  // Count content vs empty
  const addedWithContent = added.filter((s) => s.hasContent)
  const changedWithContent = changed.filter((s) => s.hasContent)
  const removedWithContent = removed.filter((s) => s.hasContent)

  console.log('=== ADDED SECTIONS ===')
  for (const s of added) {
    const status = s.hasContent ? '✓' : '✗'
    console.log(`  ${status} ${s.id} - ${s.lineInfo}`)
  }

  console.log('\n=== REMOVED SECTIONS ===')
  for (const s of removed) {
    const status = s.hasContent ? '✓' : '✗'
    console.log(`  ${status} ${s.id} - ${s.lineInfo}`)
  }

  console.log('\n=== CHANGED SECTIONS ===')
  for (const s of changed) {
    const status = s.hasContent ? '✓' : '✗'
    console.log(`  ${status} ${s.id} - ${s.lineInfo}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`\nADDED: ${added.length} total`)
  console.log(`  With content: ${addedWithContent.length}`)
  console.log(`  Empty: ${added.length - addedWithContent.length}`)

  console.log(`\nREMOVED: ${removed.length} total`)
  console.log(`  With content: ${removedWithContent.length}`)
  console.log(`  Empty: ${removed.length - removedWithContent.length}`)

  console.log(`\nCHANGED: ${changed.length} total`)
  console.log(`  With content: ${changedWithContent.length}`)
  console.log(`  Empty (0/0): ${changed.length - changedWithContent.length}`)

  const totalWithContent =
    addedWithContent.length +
    removedWithContent.length +
    changedWithContent.length
  const totalSections = sectionData.length

  console.log(`\n${'='.repeat(60)}`)
  console.log(`TOTAL SECTIONS: ${totalSections}`)
  console.log(
    `WITH ACTUAL CONTENT: ${totalWithContent} (${((totalWithContent / totalSections) * 100).toFixed(1)}%)`
  )
  console.log(
    `EMPTY/NO DIFF: ${totalSections - totalWithContent} (${(((totalSections - totalWithContent) / totalSections) * 100).toFixed(1)}%)`
  )

  await browser.close()
}

main().catch(console.error)
