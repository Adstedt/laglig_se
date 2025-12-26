/**
 * Simulate SFS Sync Cron Job V2 - Full Text Extraction
 *
 * Story 2.28: Test the sync-sfs-updates flow with FULL TEXT extraction
 *
 * This version extracts ALL amendment references from the law text,
 * not just the latest one from undertitel. This catches multiple
 * amendments to the same law on the same day.
 *
 * It also simulates DB filtering - only processing amendments we haven't
 * seen before (from previous sync runs).
 *
 * Usage: pnpm tsx scripts/simulate-sfs-sync-v2.ts [YYYY-MM-DD]
 */

import { constructPdfUrls, constructStoragePath } from '../lib/sfs'
import {
  parseUndertitel,
  extractAllSfsReferences,
} from '../lib/sync/section-parser'

interface RiksdagenDocument {
  dok_id: string
  beteckning: string
  titel: string
  datum: string
  publicerad: string
  systemdatum: string
  undertitel?: string
}

const _LOOKBACK_HOURS = 48

// Simulate "already processed" amendments (would be in DB in real cron)
// In the real cron, we query AmendmentDocument table to check what we've already processed
const simulatedExistingAmendments = new Set<string>()

async function fetchRecentlyUpdatedDocuments(
  targetDate: Date,
  maxDocs: number = 30
): Promise<RiksdagenDocument[]> {
  const allDocs: RiksdagenDocument[] = []

  console.log(
    `\n📅 Simulating sync-sfs-updates as of: ${targetDate.toISOString()}`
  )
  console.log(
    `🔍 Fetching most recently updated documents (simulating what we'd see on that date)`
  )

  for (let page = 1; page <= 3; page++) {
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

    for (const doc of documents) {
      allDocs.push(doc)
      if (allDocs.length >= maxDocs) break
    }

    if (allDocs.length >= maxDocs) {
      console.log(`   ⏹️ Reached max documents (${maxDocs})`)
      break
    }

    await new Promise((r) => setTimeout(r, 200))
  }

  return allDocs
}

async function fetchLawFullText(dokId: string): Promise<string | null> {
  try {
    const url = `https://data.riksdagen.se/dokument/${dokId}.text`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Laglig.se/1.0 (Simulation)',
      },
    })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
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
  source: 'undertitel' | 'fulltext'
}

async function simulate(targetDateStr?: string) {
  const targetDate = targetDateStr
    ? new Date(targetDateStr + 'T06:00:00Z')
    : new Date()

  const currentYear = targetDate.getFullYear()

  console.log('\n' + '='.repeat(70))
  console.log('🔄 SFS SYNC-UPDATES SIMULATION V2 - Full Text Extraction')
  console.log('='.repeat(70))
  console.log(
    '\n✨ NEW: Extracts ALL amendments from full text, not just undertitel'
  )

  const documents = await fetchRecentlyUpdatedDocuments(targetDate)
  console.log(
    `\n📊 Found ${documents.length} documents with systemdatum in window`
  )

  // Track all amendments detected
  const amendmentsDetected: AmendmentDetection[] = []
  const undertitelOnly: string[] = []
  const fullTextExtra: string[] = []

  // Process each document
  let processed = 0
  for (const doc of documents) {
    processed++
    const amendmentDate = doc.systemdatum.split(' ')[0]

    // Method 1: undertitel (old way)
    const undertitelAmendment = parseUndertitel(doc.undertitel || '')

    // Method 2: Fetch full text and extract ALL amendments
    console.log(
      `\n[${processed}/${documents.length}] Fetching full text for SFS ${doc.beteckning}...`
    )
    const fullText = await fetchLawFullText(doc.dok_id)

    if (!fullText) {
      console.log(`   ⚠️ Could not fetch full text`)
      // Fall back to undertitel only
      if (undertitelAmendment) {
        const sfsNum = undertitelAmendment.replace(/^SFS\s*/i, '')
        const pdfUrls = constructPdfUrls(sfsNum, amendmentDate)
        amendmentsDetected.push({
          baseDoc: {
            sfsNumber: doc.beteckning,
            title: doc.titel.substring(0, 50) + '...',
            systemdatum: doc.systemdatum,
          },
          amendmentSfs: sfsNum,
          pdfUrl: pdfUrls.pdf,
          storagePath: constructStoragePath(sfsNum),
          source: 'undertitel',
        })
        undertitelOnly.push(sfsNum)
      }
      continue
    }

    // Extract ALL SFS references from full text for current year
    const allSfsRefs = extractAllSfsReferences(fullText)
    const currentYearRefs = allSfsRefs.filter((sfs) =>
      sfs.startsWith(`${currentYear}:`)
    )

    // Simulate DB filtering: Only process amendments we haven't seen before
    // In a fresh sync on a specific date, we'd only have amendments from BEFORE that date
    // For this simulation, we filter to amendments that are "recent" (high numbers = published later in year)
    const targetMonth = targetDate.getMonth() + 1 // 1-12

    // Heuristic: SFS numbers are assigned sequentially through the year
    // ~1500 SFS documents per year ≈ 125/month
    // So for November (month 11), we'd expect amendments up to ~1375
    const estimatedMaxSfsForMonth = Math.floor(targetMonth * 125) + 200 // Buffer for variation
    const estimatedMinSfsForMonth = Math.max(
      0,
      Math.floor((targetMonth - 1) * 125) - 100
    )

    // Filter to amendments that would be "new" on the target date
    // In real DB: we'd check AmendmentDocument.created_at < targetDate
    const newAmendments = currentYearRefs.filter((sfs) => {
      const num = parseInt(sfs.split(':')[1] || '0')
      // Only include amendments that:
      // 1. Are within plausible range for target month
      // 2. Haven't been "processed" yet in our simulation
      const inRange =
        num <= estimatedMaxSfsForMonth && num >= estimatedMinSfsForMonth
      const notProcessed = !simulatedExistingAmendments.has(sfs)
      return inRange && notProcessed
    })

    console.log(
      `   Found ${allSfsRefs.length} total SFS refs, ${currentYearRefs.length} from ${currentYear}, ${newAmendments.length} new for ${targetDate.toISOString().split('T')[0]}`
    )

    // Track which we found via undertitel vs full text
    const undertitelSfs = undertitelAmendment?.replace(/^SFS\s*/i, '')

    for (const sfsNum of newAmendments) {
      // Mark as "processed" so we don't count duplicates
      simulatedExistingAmendments.add(sfsNum)

      const pdfUrls = constructPdfUrls(sfsNum, amendmentDate)
      const isFromUndertitel = sfsNum === undertitelSfs

      amendmentsDetected.push({
        baseDoc: {
          sfsNumber: doc.beteckning,
          title: doc.titel.substring(0, 50) + '...',
          systemdatum: doc.systemdatum,
        },
        amendmentSfs: sfsNum,
        pdfUrl: pdfUrls.pdf,
        storagePath: constructStoragePath(sfsNum),
        source: isFromUndertitel ? 'undertitel' : 'fulltext',
      })

      if (isFromUndertitel) {
        undertitelOnly.push(sfsNum)
      } else {
        fullTextExtra.push(sfsNum)
      }
    }

    // Small delay
    await new Promise((r) => setTimeout(r, 100))
  }

  // Deduplicate amendments (same SFS might appear in multiple base docs)
  const uniqueAmendments = new Map<string, AmendmentDetection>()
  for (const a of amendmentsDetected) {
    if (!uniqueAmendments.has(a.amendmentSfs)) {
      uniqueAmendments.set(a.amendmentSfs, a)
    }
  }

  // Print results
  console.log('\n' + '='.repeat(70))
  console.log('📈 SIMULATION RESULTS')
  console.log('='.repeat(70))

  console.log(`\n📅 Simulated Date: ${targetDate.toISOString().split('T')[0]}`)
  console.log(`📊 Documents processed: ${documents.length}`)
  console.log(`🔄 Unique amendments detected: ${uniqueAmendments.size}`)
  console.log(`   ├─ Via undertitel only: ${new Set(undertitelOnly).size}`)
  console.log(
    `   └─ Extra via full text: ${new Set(fullTextExtra).size} ← NEW!`
  )

  // Show the extra amendments we caught
  if (fullTextExtra.length > 0) {
    console.log('\n' + '-'.repeat(70))
    console.log(
      '✨ EXTRA AMENDMENTS CAUGHT VIA FULL TEXT (would be missed by undertitel):'
    )
    console.log('-'.repeat(70))

    const uniqueExtra = [...new Set(fullTextExtra)].sort()
    for (const sfs of uniqueExtra) {
      const detection = amendmentsDetected.find((a) => a.amendmentSfs === sfs)
      if (detection) {
        console.log(`\n   📄 SFS ${sfs}`)
        console.log(
          `      Base: ${detection.baseDoc.sfsNumber} (${detection.baseDoc.title})`
        )
        console.log(`      PDF: ${detection.pdfUrl}`)
      }
    }
  }

  // List all unique amendments sorted
  console.log('\n' + '-'.repeat(70))
  console.log(`📋 ALL ${uniqueAmendments.size} UNIQUE AMENDMENTS DETECTED:`)
  console.log('-'.repeat(70))

  const sortedAmendments = [...uniqueAmendments.keys()].sort((a, b) => {
    const [, numA] = a.split(':')
    const [, numB] = b.split(':')
    return parseInt(numB) - parseInt(numA)
  })

  for (const sfs of sortedAmendments) {
    const a = uniqueAmendments.get(sfs)!
    const marker = a.source === 'fulltext' ? '✨' : '  '
    console.log(
      `   ${marker} SFS ${sfs.padEnd(12)} ← ${a.baseDoc.sfsNumber} (${a.source})`
    )
  }

  // Verify some PDFs exist
  console.log('\n' + '-'.repeat(70))
  console.log('🧪 Verifying PDF URLs...')
  console.log('-'.repeat(70))

  const toVerify = sortedAmendments.slice(0, 5)
  for (const sfs of toVerify) {
    const a = uniqueAmendments.get(sfs)!
    try {
      const res = await fetch(a.pdfUrl, { method: 'HEAD' })
      const marker = a.source === 'fulltext' ? '✨' : '  '
      console.log(
        `   ${marker} SFS ${sfs}: ${res.ok ? '✓ PDF exists' : '✗ NOT FOUND'} (${res.status})`
      )
    } catch {
      console.log(`      SFS ${sfs}: ✗ Error checking`)
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('✅ SIMULATION COMPLETE')
  console.log('='.repeat(70))
}

simulate(process.argv[2])
