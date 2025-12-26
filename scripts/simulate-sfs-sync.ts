/**
 * Simulate SFS Sync Cron Job
 *
 * Story 2.28: Test the sync-sfs-updates flow
 *
 * KEY INSIGHT: Amendment documents do NOT exist in Riksdagen API.
 * They only exist on svenskforfattningssamling.se.
 * We detect amendments via the `undertitel` field on BASE documents.
 *
 * Usage: pnpm tsx scripts/simulate-sfs-sync.ts [YYYY-MM-DD]
 */

import { constructPdfUrls, constructStoragePath } from '../lib/sfs'
import { parseUndertitel } from '../lib/sync/section-parser'

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  titel: string
  datum: string
  publicerad: string
  systemdatum: string
  undertitel?: string
}

const LOOKBACK_HOURS = 48

async function fetchRecentlyUpdatedDocuments(
  targetDate: Date
): Promise<RiksdagenDocument[]> {
  const allDocs: RiksdagenDocument[] = []
  const cutoffTime = new Date(targetDate)
  cutoffTime.setHours(cutoffTime.getHours() - LOOKBACK_HOURS)

  console.log(
    `\n📅 Simulating sync-sfs-updates as of: ${targetDate.toISOString()}`
  )
  console.log(
    `🔍 Looking back ${LOOKBACK_HOURS} hours to: ${cutoffTime.toISOString()}`
  )
  console.log(`📊 Checking systemdatum changes (updates to existing docs)`)

  for (let page = 1; page <= 5; page++) {
    const url = new URL('https://data.riksdagen.se/dokumentlista/')
    url.searchParams.set('doktyp', 'sfs')
    url.searchParams.set('utformat', 'json')
    url.searchParams.set('sz', '50')
    url.searchParams.set('p', page.toString())
    url.searchParams.set('sort', 'systemdatum')
    url.searchParams.set('sortorder', 'desc')

    console.log(`\n📡 Fetching page ${page}...`)

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Laglig.se/1.0 (Simulation)',
        Accept: 'application/json',
      },
    })

    if (!response.ok) throw new Error(`API error: ${response.status}`)

    const data = await response.json()
    const documents: RiksdagenDocument[] = data.dokumentlista.dokument || []
    console.log(`   Found ${documents.length} documents`)

    let reachedCutoff = false
    for (const doc of documents) {
      const docSystemdatum = new Date(doc.systemdatum.replace(' ', 'T') + 'Z')

      if (docSystemdatum <= targetDate && docSystemdatum >= cutoffTime) {
        allDocs.push(doc)
      }

      if (docSystemdatum < cutoffTime) {
        reachedCutoff = true
        break
      }
    }

    if (reachedCutoff) {
      console.log(`   ⏹️ Reached cutoff date`)
      break
    }

    await new Promise((r) => setTimeout(r, 200))
  }

  return allDocs
}

interface AmendmentDetection {
  baseDoc: {
    sfsNumber: string
    title: string
    systemdatum: string
  }
  amendmentSfs: string
  pdfUrl: string
  storagePath: string
}

async function simulate(targetDateStr?: string) {
  const targetDate = targetDateStr
    ? new Date(targetDateStr + 'T06:00:00Z')
    : new Date()

  console.log('\n' + '='.repeat(70))
  console.log('🔄 SFS SYNC-UPDATES SIMULATION - Story 2.28')
  console.log('='.repeat(70))
  console.log(
    '\n⚠️  KEY INSIGHT: Amendment documents do NOT exist in Riksdagen API!'
  )
  console.log('   We detect them via `undertitel` field on BASE documents.')

  const documents = await fetchRecentlyUpdatedDocuments(targetDate)
  console.log(
    `\n📊 Found ${documents.length} documents with systemdatum in window`
  )

  // Find documents with amendments (via undertitel)
  const amendmentsDetected: AmendmentDetection[] = []
  const docsWithAmendments: string[] = []
  const docsWithoutAmendments: string[] = []

  for (const doc of documents) {
    const amendmentSfs = parseUndertitel(doc.undertitel || '')

    if (amendmentSfs) {
      docsWithAmendments.push(`SFS ${doc.beteckning}`)
      // KEY FIX: Use systemdatum (base doc update time) as proxy for amendment publication date
      // NOT doc.datum which is the base document's original publication date
      const amendmentDate = doc.systemdatum.split(' ')[0] // Extract YYYY-MM-DD from "YYYY-MM-DD HH:MM:SS"
      const pdfUrls = constructPdfUrls(amendmentSfs, amendmentDate)

      amendmentsDetected.push({
        baseDoc: {
          sfsNumber: doc.beteckning,
          title: doc.titel.substring(0, 60) + '...',
          systemdatum: doc.systemdatum,
        },
        amendmentSfs,
        pdfUrl: pdfUrls.pdf,
        storagePath: constructStoragePath(amendmentSfs),
      })
    } else {
      docsWithoutAmendments.push(`SFS ${doc.beteckning}`)
    }
  }

  // Print results
  console.log('\n' + '='.repeat(70))
  console.log('📈 SIMULATION RESULTS')
  console.log('='.repeat(70))

  console.log(`\n📅 Simulated Date: ${targetDate.toISOString().split('T')[0]}`)
  console.log(`📊 Documents updated in window: ${documents.length}`)
  console.log(
    `🔄 Documents with new amendments (undertitel): ${amendmentsDetected.length}`
  )
  console.log(
    `📄 Documents without amendments: ${docsWithoutAmendments.length}`
  )

  if (amendmentsDetected.length > 0) {
    console.log('\n' + '-'.repeat(70))
    console.log(
      '🔄 AMENDMENTS DETECTED (would trigger PDF fetch + LLM parsing):'
    )
    console.log('-'.repeat(70))

    for (const a of amendmentsDetected) {
      console.log(`\n   📄 Base: SFS ${a.baseDoc.sfsNumber}`)
      console.log(`      Title: ${a.baseDoc.title}`)
      console.log(`      Systemdatum: ${a.baseDoc.systemdatum}`)
      console.log(`      `)
      console.log(`      → Amendment: ${a.amendmentSfs}`)
      console.log(`      → PDF URL: ${a.pdfUrl}`)
      console.log(`      → Storage: ${a.storagePath}`)
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('📝 WHAT sync-sfs-updates WOULD DO:')
  console.log('='.repeat(70))
  console.log(
    `\n   1. Update ${documents.length} base documents with new text/metadata`
  )
  console.log(`   2. For ${amendmentsDetected.length} amendments:`)
  console.log(`      a. Fetch PDF from svenskforfattningssamling.se`)
  console.log(`      b. Store in Supabase sfs-pdfs bucket`)
  console.log(`      c. Create AmendmentDocument record`)
  console.log(`      d. Parse with LLM → create SectionChange records`)
  console.log(`\n   LLM API calls: ${amendmentsDetected.length}`)

  if (amendmentsDetected.length > 0) {
    console.log('\n' + '-'.repeat(70))
    console.log(
      '🧪 Verifying amendment PDFs exist on svenskforfattningssamling.se...'
    )
    console.log('-'.repeat(70))

    for (const a of amendmentsDetected.slice(0, 3)) {
      try {
        const res = await fetch(a.pdfUrl, { method: 'HEAD' })
        console.log(
          `   ${a.amendmentSfs}: ${res.ok ? '✓ PDF exists' : '✗ NOT FOUND'} (${res.status})`
        )
      } catch {
        console.log(`   ${a.amendmentSfs}: ✗ Error checking`)
      }
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('✅ SIMULATION COMPLETE')
  console.log('='.repeat(70))
}

simulate(process.argv[2])
