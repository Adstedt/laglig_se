/**
 * Validate Amendment Detection V2
 *
 * KEY INSIGHT: Amendment documents do NOT exist in Riksdagen API!
 * They only exist on svenskforfattningssamling.se.
 * We detect them via the `undertitel` field on BASE documents.
 *
 * This script:
 * 1. Takes a list of amendment SFS numbers (from svenskforfattningssamling.se)
 * 2. For each, finds the BASE law it amends
 * 3. Checks if we'd detect it via undertitel OR full text extraction
 *
 * Usage: pnpm tsx scripts/validate-detection-v2.ts
 */

import {
  extractAllSfsReferences,
  parseUndertitel,
} from '../lib/sync/section-parser'

interface AmendmentToValidate {
  sfsNumber: string
  baseLawSfs: string
  title: string
}

interface ValidationResult {
  amendment: AmendmentToValidate
  baseLawFound: boolean
  undertitelValue: string | null
  detectedViaUndertitel: boolean
  detectedViaFullText: boolean
  allAmendmentsInFullText: string[]
}

// Amendments published on Dec 17, 2025 (from user's screenshot)
// Format: [amendmentSfs, baseLawSfs, title]
const DEC_17_AMENDMENTS: [string, string, string][] = [
  [
    '2025:1521',
    '2013:1007',
    'Förordning om ändring i förordningen om statsbidrag till försvarshistoriska museiverksamheter',
  ],
  [
    '2025:1520',
    '2011:1565',
    'Förordningen om ändring av förordningen om statsbidrag till kostnader för vård av kulturhistoriskt värdefulla fartyg',
  ],
  [
    '2025:1517',
    '2009:145',
    'Förordning om ändring i förordningen med instruktion för Tillväxtverket',
  ],
  [
    '2025:1516',
    '2020:337',
    'Förordning om ändring i förordningen om statsbidrag till aktörer inom bildkonst, form och konsthantverk',
  ],
  [
    '2025:1515',
    '2012:515',
    'Förordning om ändring i förordningen med instruktion för Statens kulturråd',
  ],
  [
    '2025:1514',
    '2007:1193',
    'Förordning om upphävande av förordningen med instruktion för Nämnden för hemslöjdsfrågor',
  ],
  [
    '2025:1513',
    '2007:951',
    'Förordning om ändring i förordningen med instruktion för Post- och telestyrelsen',
  ],
  [
    '2025:1512',
    '2022:511',
    'Förordning om ändring i förordningen om elektronisk kommunikation',
  ],
  [
    '2025:1511',
    '2022:482',
    'Lag om ändring i lagen om elektronisk kommunikation',
  ],
  [
    '2025:1510',
    '2006:24',
    'Lag om ändring i lagen om nationella toppdomäner för Sverige på internet',
  ],
  [
    '2025:1509',
    '2009:641',
    'Förordning om ändring i offentlighets- och sekretessförordningen',
  ],
  [
    '2025:1508',
    '2009:400',
    'Lag om ändring i offentlighets- och sekretesslagen',
  ],
]

// Amendments published on Dec 23, 2025 (from earlier discussion)
const DEC_23_AMENDMENTS: [string, string, string][] = [
  [
    '2025:1581',
    '2014:425',
    'Förordning om ändring i förordningen om bekämpningsmedel',
  ],
  [
    '2025:1580',
    '2013:63',
    'Förordning om ändring i förordningen om bekämpningsmedelsavgifter',
  ],
  [
    '2025:1579',
    '1998:940',
    'Förordning om ändring i förordningen om avgifter för prövning och tillsyn enligt miljöbalken',
  ],
  [
    '2025:1578',
    '2023:910',
    'Förordning om ändring i förordningen med instruktion för Finansinspektionen',
  ],
  ['2025:1559', '1993:100', 'Förordning om ändring i högskoleförordningen'], // Same base as 1560!
  ['2025:1560', '1993:100', 'Förordning om ändring i högskoleförordningen'], // Same base as 1559!
  ['2025:1547', '1999:1395', 'Lag om ändring i studiestödslagen'], // Same base as 1567!
  ['2025:1567', '1999:1395', 'Lag om ändring i studiestödslagen'], // Same base as 1547!
]

async function fetchBaseLawInfo(baseLawSfs: string): Promise<{
  found: boolean
  dokId: string | null
  undertitel: string | null
}> {
  // Use 'sok' parameter instead of 'beteckning' - it works better for exact matching
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&sok=${baseLawSfs}&utformat=json&sz=20`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Laglig.se/1.0 (Validation)' },
  })
  const data = await res.json()
  // Find exact match by beteckning
  const doc = data.dokumentlista.dokument?.find(
    (d: { beteckning: string; dok_id?: string; undertitel?: string }) =>
      d.beteckning === baseLawSfs
  )

  return {
    found: !!doc,
    dokId: doc?.dok_id || null,
    undertitel: doc?.undertitel || null,
  }
}

async function fetchBaseLawFullText(dokId: string): Promise<string> {
  const url = `https://data.riksdagen.se/dokument/${dokId}.text`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Laglig.se/1.0 (Validation)' },
  })
  return res.ok ? await res.text() : ''
}

async function validateAmendments(
  amendments: [string, string, string][],
  label: string
): Promise<ValidationResult[]> {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`🔬 Validating ${label}`)
  console.log(`${'='.repeat(70)}`)

  const results: ValidationResult[] = []

  for (const [sfsNumber, baseLawSfs, title] of amendments) {
    process.stdout.write(
      `\r   Checking SFS ${sfsNumber} (base: ${baseLawSfs})...          `
    )

    // Fetch base law info
    const baseInfo = await fetchBaseLawInfo(baseLawSfs)

    if (!baseInfo.found) {
      results.push({
        amendment: { sfsNumber, baseLawSfs, title },
        baseLawFound: false,
        undertitelValue: null,
        detectedViaUndertitel: false,
        detectedViaFullText: false,
        allAmendmentsInFullText: [],
      })
      continue
    }

    // Check undertitel
    const undertitelAmendment = parseUndertitel(baseInfo.undertitel || '')
    const undertitelSfs = undertitelAmendment?.replace(/^SFS\s*/i, '') || null
    const detectedViaUndertitel = undertitelSfs === sfsNumber

    // Fetch full text and extract all amendments
    let allAmendmentsInFullText: string[] = []
    let detectedViaFullText = false

    if (baseInfo.dokId) {
      const fullText = await fetchBaseLawFullText(baseInfo.dokId)
      allAmendmentsInFullText = extractAllSfsReferences(fullText)
      detectedViaFullText = allAmendmentsInFullText.includes(sfsNumber)
    }

    results.push({
      amendment: { sfsNumber, baseLawSfs, title },
      baseLawFound: true,
      undertitelValue: undertitelSfs,
      detectedViaUndertitel,
      detectedViaFullText,
      allAmendmentsInFullText: allAmendmentsInFullText.filter((s) =>
        s.startsWith('2025:')
      ),
    })

    await new Promise((r) => setTimeout(r, 150))
  }

  console.log('\n')
  return results
}

function printResults(results: ValidationResult[], label: string) {
  console.log(`\n${'─'.repeat(70)}`)
  console.log(`📊 Results for ${label}`)
  console.log(`${'─'.repeat(70)}`)

  const detected = results.filter(
    (r) => r.detectedViaUndertitel || r.detectedViaFullText
  )
  const onlyUndertitel = results.filter(
    (r) => r.detectedViaUndertitel && !r.detectedViaFullText
  )
  const onlyFullText = results.filter(
    (r) => !r.detectedViaUndertitel && r.detectedViaFullText
  )
  const both = results.filter(
    (r) => r.detectedViaUndertitel && r.detectedViaFullText
  )
  const missed = results.filter(
    (r) => r.baseLawFound && !r.detectedViaUndertitel && !r.detectedViaFullText
  )
  const baseMissing = results.filter((r) => !r.baseLawFound)

  console.log(`\n   Total amendments: ${results.length}`)
  console.log(`   `)
  console.log(
    `   ✅ Detected: ${detected.length} (${Math.round((detected.length / results.length) * 100)}%)`
  )
  console.log(`      ├─ Via undertitel only: ${onlyUndertitel.length}`)
  console.log(`      ├─ Via fulltext only: ${onlyFullText.length} ✨ EXTRA`)
  console.log(`      └─ Via both: ${both.length}`)
  console.log(`   `)
  console.log(`   ❌ Missed (base found but not detected): ${missed.length}`)
  console.log(`   ⚠️  Base law not in API: ${baseMissing.length}`)

  // Show detailed results
  console.log(`\n   ${'─'.repeat(60)}`)
  console.log(`   DETAILED RESULTS:`)
  console.log(`   ${'─'.repeat(60)}`)

  for (const r of results) {
    const status = !r.baseLawFound
      ? '⚠️ '
      : r.detectedViaUndertitel && r.detectedViaFullText
        ? '✅'
        : r.detectedViaFullText
          ? '✨'
          : r.detectedViaUndertitel
            ? '✓ '
            : '❌'

    const method = !r.baseLawFound
      ? 'base missing'
      : r.detectedViaUndertitel && r.detectedViaFullText
        ? 'undertitel + fulltext'
        : r.detectedViaFullText
          ? 'fulltext only'
          : r.detectedViaUndertitel
            ? 'undertitel only'
            : 'NOT DETECTED'

    console.log(
      `\n   ${status} SFS ${r.amendment.sfsNumber} → base ${r.amendment.baseLawSfs}`
    )
    console.log(`      Detection: ${method}`)
    if (r.baseLawFound) {
      console.log(`      undertitel shows: ${r.undertitelValue || '(none)'}`)
      if (r.allAmendmentsInFullText.length > 0) {
        console.log(
          `      Full text 2025 refs: ${r.allAmendmentsInFullText.slice(0, 5).join(', ')}${r.allAmendmentsInFullText.length > 5 ? '...' : ''}`
        )
      }
    }
  }

  // Summary comparison
  console.log(`\n   ${'─'.repeat(60)}`)
  console.log(`   METHOD COMPARISON:`)
  console.log(`   ${'─'.repeat(60)}`)

  const undertitelCount = results.filter((r) => r.detectedViaUndertitel).length
  const fullTextCount = results.filter((r) => r.detectedViaFullText).length

  console.log(`\n   Method            | Detected | Coverage`)
  console.log(`   ------------------|----------|----------`)
  console.log(
    `   Undertitel only   | ${undertitelCount.toString().padStart(8)} | ${Math.round((undertitelCount / results.length) * 100)}%`
  )
  console.log(
    `   Full text extract | ${fullTextCount.toString().padStart(8)} | ${Math.round((fullTextCount / results.length) * 100)}%`
  )
  console.log(
    `   Combined          | ${detected.length.toString().padStart(8)} | ${Math.round((detected.length / results.length) * 100)}%`
  )
}

async function main() {
  console.log('\n' + '═'.repeat(70))
  console.log('🔬 AMENDMENT DETECTION VALIDATION V2')
  console.log('═'.repeat(70))
  console.log('\n⚠️  KEY INSIGHT: Amendments do NOT exist in Riksdagen API!')
  console.log(
    '   We detect them via undertitel on BASE documents + full text extraction.'
  )

  // Validate Dec 17 amendments
  const dec17Results = await validateAmendments(
    DEC_17_AMENDMENTS,
    'December 17, 2025'
  )
  printResults(dec17Results, 'December 17, 2025')

  // Validate Dec 23 amendments (includes same-day multiple amendments)
  const dec23Results = await validateAmendments(
    DEC_23_AMENDMENTS,
    'December 23, 2025'
  )
  printResults(dec23Results, 'December 23, 2025')

  // Overall summary
  const allResults = [...dec17Results, ...dec23Results]
  console.log('\n' + '═'.repeat(70))
  console.log('📊 OVERALL SUMMARY')
  console.log('═'.repeat(70))

  const totalUndertitel = allResults.filter(
    (r) => r.detectedViaUndertitel
  ).length
  const totalFullText = allResults.filter((r) => r.detectedViaFullText).length
  const totalDetected = allResults.filter(
    (r) => r.detectedViaUndertitel || r.detectedViaFullText
  ).length
  const extraFromFullText = allResults.filter(
    (r) => r.detectedViaFullText && !r.detectedViaUndertitel
  ).length

  console.log(`\n   Total amendments tested: ${allResults.length}`)
  console.log(`   `)
  console.log(
    `   Undertitel-only approach: ${totalUndertitel}/${allResults.length} (${Math.round((totalUndertitel / allResults.length) * 100)}%)`
  )
  console.log(
    `   Full-text extraction:     ${totalFullText}/${allResults.length} (${Math.round((totalFullText / allResults.length) * 100)}%)`
  )
  console.log(
    `   Combined approach:        ${totalDetected}/${allResults.length} (${Math.round((totalDetected / allResults.length) * 100)}%)`
  )
  console.log(`   `)
  console.log(`   ✨ Extra caught by full text: ${extraFromFullText}`)

  console.log('\n' + '═'.repeat(70))
  console.log('✅ VALIDATION COMPLETE')
  console.log('═'.repeat(70))
}

main().catch(console.error)
