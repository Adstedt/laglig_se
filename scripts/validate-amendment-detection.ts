/**
 * Validate Amendment Detection
 *
 * This script validates our full text extraction approach by:
 * 1. Fetching actual published amendments from a date range
 * 2. Checking which base laws they amend
 * 3. Verifying our extraction catches them
 *
 * Usage: pnpm tsx scripts/validate-amendment-detection.ts [start-date] [end-date]
 * Example: pnpm tsx scripts/validate-amendment-detection.ts 2025-12-17 2025-12-17
 */

import { extractAllSfsReferences } from '../lib/sync/section-parser'

interface PublishedAmendment {
  sfsNumber: string
  title: string
  publishedDate: string
  baseLawSfs: string | null
  baseLawName: string | null
  type: 'amendment' | 'new' | 'repeal' | 'continuation'
}

interface ValidationResult {
  amendment: PublishedAmendment
  baseLawInApi: boolean
  detectedViaFullText: boolean
  detectedViaUndertitel: boolean
  undertitelValue: string | null
}

/**
 * Parse amendment title to extract base law info
 */
function parseAmendmentTitle(title: string): {
  baseLawSfs: string | null
  baseLawName: string | null
  type: 'amendment' | 'new' | 'repeal' | 'continuation'
} {
  // Check for repeal (upphävande)
  if (title.toLowerCase().includes('upphävande')) {
    const match = title.match(/\((\d{4}:\d+)\)/)
    return {
      baseLawSfs: match?.[1] || null,
      baseLawName: null,
      type: 'repeal',
    }
  }

  // Check for continuation (fortsatt giltighet)
  if (title.toLowerCase().includes('fortsatt giltighet')) {
    const match = title.match(/\((\d{4}:\d+)\)/)
    return {
      baseLawSfs: match?.[1] || null,
      baseLawName: null,
      type: 'continuation',
    }
  }

  // Check for amendment (ändring)
  if (title.toLowerCase().includes('ändring')) {
    // Match pattern like "ändring i förordningen (2009:641)"
    const match = title.match(/(?:i|av)\s+([^(]+?)\s*\((\d{4}:\d+)\)/i)
    if (match) {
      return {
        baseLawSfs: match[2],
        baseLawName: match[1].trim(),
        type: 'amendment',
      }
    }
  }

  // New law (no base reference)
  return {
    baseLawSfs: null,
    baseLawName: null,
    type: 'new',
  }
}

/**
 * Fetch amendments published in a date range from Riksdagen API
 * Note: API doesn't have a direct date filter for 'publicerad', so we fetch
 * recent documents and filter client-side
 */
async function fetchPublishedAmendments(
  startDate: string,
  endDate: string
): Promise<PublishedAmendment[]> {
  const amendments: PublishedAmendment[] = []
  // Parse dates with explicit time to avoid timezone issues
  const startDateObj = new Date(startDate + 'T00:00:00')
  const endDateObj = new Date(endDate + 'T23:59:59')

  console.log(
    `\n📡 Fetching SFS documents published ${startDate} to ${endDate}...`
  )

  // Fetch documents sorted by publicerad (most recent first)
  // and filter to our date range
  let foundInRange = 0
  const _passedEndDate = false

  for (let page = 1; page <= 5; page++) {
    const url = new URL('https://data.riksdagen.se/dokumentlista/')
    url.searchParams.set('doktyp', 'sfs')
    url.searchParams.set('utformat', 'json')
    url.searchParams.set('sz', '100')
    url.searchParams.set('p', page.toString())
    url.searchParams.set('sort', 'publicerad')
    url.searchParams.set('sortorder', 'desc')

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Laglig.se/1.0 (Validation)' },
    })

    if (!response.ok) throw new Error(`API error: ${response.status}`)

    const data = await response.json()
    const docs = data.dokumentlista.dokument || []

    if (docs.length === 0) break

    let pageCount = 0
    let oldestOnPage: string | null = null

    for (const doc of docs) {
      const pubDateStr = doc.publicerad?.split(' ')[0] || doc.datum
      const pubDate = new Date(pubDateStr + 'T12:00:00') // Add time to avoid timezone issues
      oldestOnPage = pubDateStr

      // Skip if outside our date range
      if (pubDate < startDateObj || pubDate > endDateObj) {
        continue
      }

      // In our date range
      const parsed = parseAmendmentTitle(doc.titel)
      amendments.push({
        sfsNumber: doc.beteckning,
        title: doc.titel,
        publishedDate: pubDateStr,
        ...parsed,
      })
      pageCount++
      foundInRange++
    }

    console.log(
      `   Page ${page}: ${pageCount} in range, oldest: ${oldestOnPage}`
    )

    // Stop after we've checked enough pages
    // The API sorting is inconsistent, so we just scan a fixed number of pages

    await new Promise((r) => setTimeout(r, 200))
  }

  console.log(`   Found ${foundInRange} documents in date range`)

  // Debug: show what we found
  if (amendments.length > 0 && amendments.length <= 20) {
    console.log('\n   Documents found:')
    for (const a of amendments) {
      console.log(
        `   - ${a.sfsNumber}: ${a.type} - ${a.title.substring(0, 60)}...`
      )
    }
  }

  return amendments
}

/**
 * Fetch base law and check if amendment is detectable
 */
async function checkBaseLaw(
  baseLawSfs: string,
  amendmentSfs: string
): Promise<{
  exists: boolean
  undertitel: string | null
  fullTextHasAmendment: boolean
  allAmendmentsInText: string[]
}> {
  // Fetch base law metadata
  const metaUrl = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&beteckning=${baseLawSfs}&utformat=json`
  const metaRes = await fetch(metaUrl, {
    headers: { 'User-Agent': 'Laglig.se/1.0 (Validation)' },
  })
  const metaData = await metaRes.json()
  const baseLawDoc = metaData.dokumentlista.dokument?.find(
    (d: { beteckning: string; dok_id: string; undertitel?: string }) =>
      d.beteckning === baseLawSfs
  )

  if (!baseLawDoc) {
    return {
      exists: false,
      undertitel: null,
      fullTextHasAmendment: false,
      allAmendmentsInText: [],
    }
  }

  // Fetch full text
  const textUrl = `https://data.riksdagen.se/dokument/${baseLawDoc.dok_id}.text`
  const textRes = await fetch(textUrl, {
    headers: { 'User-Agent': 'Laglig.se/1.0 (Validation)' },
  })
  const fullText = textRes.ok ? await textRes.text() : ''

  // Extract all SFS references from full text
  const allRefs = extractAllSfsReferences(fullText)

  // Check if our specific amendment is in the full text
  const amendmentYear = amendmentSfs.split(':')[0]
  const _amendmentNum = amendmentSfs.split(':')[1]
  const fullTextHasAmendment = allRefs.includes(amendmentSfs)

  return {
    exists: true,
    undertitel: baseLawDoc.undertitel || null,
    fullTextHasAmendment,
    allAmendmentsInText: allRefs.filter((r) =>
      r.startsWith(`${amendmentYear}:`)
    ),
  }
}

async function validate(startDate: string, endDate: string) {
  console.log('\n' + '='.repeat(70))
  console.log('🔬 AMENDMENT DETECTION VALIDATION')
  console.log('='.repeat(70))

  // Step 1: Fetch published amendments
  const published = await fetchPublishedAmendments(startDate, endDate)
  console.log(`\n📊 Found ${published.length} documents published in range`)

  // Categorize
  const byType = {
    amendment: published.filter((a) => a.type === 'amendment'),
    new: published.filter((a) => a.type === 'new'),
    repeal: published.filter((a) => a.type === 'repeal'),
    continuation: published.filter((a) => a.type === 'continuation'),
  }

  console.log(`   ├─ Amendments (ändring): ${byType.amendment.length}`)
  console.log(`   ├─ New laws: ${byType.new.length}`)
  console.log(`   ├─ Repeals (upphävande): ${byType.repeal.length}`)
  console.log(`   └─ Continuations: ${byType.continuation.length}`)

  // Step 2: For each amendment, check if we'd detect it
  console.log('\n' + '-'.repeat(70))
  console.log('🔍 VALIDATING AMENDMENT DETECTION')
  console.log('-'.repeat(70))

  const results: ValidationResult[] = []
  let checked = 0

  for (const amendment of byType.amendment) {
    if (!amendment.baseLawSfs) continue

    checked++
    process.stdout.write(
      `\r   Checking ${checked}/${byType.amendment.length}: SFS ${amendment.sfsNumber}...`
    )

    const check = await checkBaseLaw(amendment.baseLawSfs, amendment.sfsNumber)

    // Check undertitel
    const undertitelMatch = check.undertitel?.match(
      /t\.o\.m\.\s*SFS\s*(\d{4}:\d+)/i
    )
    const undertitelSfs = undertitelMatch?.[1] || null
    const detectedViaUndertitel = undertitelSfs === amendment.sfsNumber

    results.push({
      amendment,
      baseLawInApi: check.exists,
      detectedViaFullText: check.fullTextHasAmendment,
      detectedViaUndertitel,
      undertitelValue: undertitelSfs,
    })

    await new Promise((r) => setTimeout(r, 100))
  }

  console.log('\n')

  // Step 3: Analyze results
  console.log('\n' + '='.repeat(70))
  console.log('📈 VALIDATION RESULTS')
  console.log('='.repeat(70))

  const detected = results.filter(
    (r) => r.detectedViaFullText || r.detectedViaUndertitel
  )
  const onlyUndertitel = results.filter(
    (r) => r.detectedViaUndertitel && !r.detectedViaFullText
  )
  const onlyFullText = results.filter(
    (r) => r.detectedViaFullText && !r.detectedViaUndertitel
  )
  const both = results.filter(
    (r) => r.detectedViaFullText && r.detectedViaUndertitel
  )
  const missed = results.filter(
    (r) => !r.detectedViaFullText && !r.detectedViaUndertitel
  )
  const baseLawMissing = results.filter((r) => !r.baseLawInApi)

  console.log(`\n📊 Summary for ${startDate} to ${endDate}:`)
  console.log(`   Total amendments checked: ${results.length}`)
  console.log(`   `)
  console.log(
    `   ✅ Detected (total): ${detected.length} (${Math.round((detected.length / results.length) * 100)}%)`
  )
  console.log(`      ├─ Via undertitel only: ${onlyUndertitel.length}`)
  console.log(
    `      ├─ Via fulltext only: ${onlyFullText.length} ← EXTRA CAUGHT!`
  )
  console.log(`      └─ Via both: ${both.length}`)
  console.log(`   `)
  console.log(`   ❌ Missed: ${missed.length}`)
  console.log(`   ⚠️  Base law not in API: ${baseLawMissing.length}`)

  // Show details of what we'd miss with undertitel-only
  if (onlyFullText.length > 0) {
    console.log('\n' + '-'.repeat(70))
    console.log(
      '✨ AMENDMENTS CAUGHT ONLY VIA FULL TEXT (undertitel would miss):'
    )
    console.log('-'.repeat(70))

    for (const r of onlyFullText.slice(0, 10)) {
      console.log(`\n   SFS ${r.amendment.sfsNumber}`)
      console.log(
        `   Base: ${r.amendment.baseLawSfs} (${r.amendment.baseLawName})`
      )
      console.log(`   undertitel shows: ${r.undertitelValue || '(none)'}`)
    }

    if (onlyFullText.length > 10) {
      console.log(`\n   ... and ${onlyFullText.length - 10} more`)
    }
  }

  // Show missed amendments
  if (missed.length > 0) {
    console.log('\n' + '-'.repeat(70))
    console.log('❌ AMENDMENTS NOT DETECTED (investigation needed):')
    console.log('-'.repeat(70))

    for (const r of missed.slice(0, 10)) {
      console.log(`\n   SFS ${r.amendment.sfsNumber}`)
      console.log(
        `   Base: ${r.amendment.baseLawSfs} (${r.amendment.baseLawName})`
      )
      console.log(`   Base law in API: ${r.baseLawInApi ? 'Yes' : 'No'}`)
      console.log(`   undertitel: ${r.undertitelValue || '(none)'}`)
    }
  }

  // Comparison summary
  console.log('\n' + '='.repeat(70))
  console.log('📊 DETECTION METHOD COMPARISON')
  console.log('='.repeat(70))

  const undertitelTotal = results.filter((r) => r.detectedViaUndertitel).length
  const fullTextTotal = results.filter((r) => r.detectedViaFullText).length

  console.log(`\n   Method              | Detected | Coverage`)
  console.log(`   -------------------|----------|----------`)
  console.log(
    `   Undertitel only    | ${undertitelTotal.toString().padStart(8)} | ${Math.round((undertitelTotal / results.length) * 100)}%`
  )
  console.log(
    `   Full text extract  | ${fullTextTotal.toString().padStart(8)} | ${Math.round((fullTextTotal / results.length) * 100)}%`
  )
  console.log(
    `   Combined           | ${detected.length.toString().padStart(8)} | ${Math.round((detected.length / results.length) * 100)}%`
  )

  console.log('\n' + '='.repeat(70))
  console.log('✅ VALIDATION COMPLETE')
  console.log('='.repeat(70))

  return {
    total: results.length,
    detected: detected.length,
    onlyFullText: onlyFullText.length,
    onlyUndertitel: onlyUndertitel.length,
    missed: missed.length,
  }
}

// Main
const startDate = process.argv[2] || '2025-12-17'
const endDate = process.argv[3] || startDate

validate(startDate, endDate).catch(console.error)
