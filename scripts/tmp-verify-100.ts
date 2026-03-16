/**
 * Verify normalization quality on 100 random SFS laws.
 * Fetch raw from Riksdag API, compare structural markers with DB.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchRaw(sfsNumber: string): Promise<string | null> {
  const num = sfsNumber.replace('SFS ', '')
  const dokId = `sfs-${num.replace(':', '-')}`
  const url = `https://data.riksdagen.se/dokument/${dokId}.html`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/html', 'User-Agent': 'Laglig.se/1.0' },
    })
    if (!res.ok) return null
    const html = await res.text()
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    return (bodyMatch?.[1] || html).trim()
  } catch {
    return null
  }
}

interface CompareResult {
  docNum: string
  size: number
  // Did normalization add these?
  addedWrapper: boolean
  addedLovhead: boolean
  addedBody: boolean
  addedKapitel: boolean
  addedParagraph: boolean // h3.paragraph
  addedPText: boolean
  addedFooter: boolean
  // Did normalization remove these?
  removedOldBold: boolean
  removedOldNameK: boolean
  // Counts preserved?
  rawParagrafCount: number
  dbParagrafCount: number
  paragrafDelta: number
  // Quality flags
  verdict: 'GOOD' | 'PARTIAL' | 'REGRESSION' | 'SKIP'
  issues: string[]
}

function compare(
  raw: string,
  db: string
): Omit<CompareResult, 'docNum' | 'size'> {
  const issues: string[] = []

  const rawHasWrapper = raw.includes('class="legal-document"')
  const dbHasWrapper = db.includes('class="legal-document"')
  const addedWrapper = !rawHasWrapper && dbHasWrapper

  const addedLovhead =
    !raw.includes('class="lovhead"') && db.includes('class="lovhead"')
  const addedBody = !raw.includes('class="body"') && db.includes('class="body"')
  const addedKapitel =
    !raw.includes('class="kapitel"') && db.includes('class="kapitel"')
  const addedParagraph =
    !raw.includes('class="paragraph"') && db.includes('class="paragraph"')
  const addedPText =
    !raw.includes('class="text"') && db.includes('class="text"')
  const addedFooter =
    !raw.includes('class="back"') && db.includes('class="back"')

  const rawOldBold = /<b>\d+[a-z]?\s*§<\/b>/.test(raw)
  const dbOldBold = /<b>\d+[a-z]?\s*§<\/b>/.test(db)
  const removedOldBold = rawOldBold && !dbOldBold

  const rawOldNameK = /<a\s+name="K\d/.test(raw)
  const dbOldNameK = /<a\s+name="K\d/.test(db)
  const removedOldNameK = rawOldNameK && !dbOldNameK

  const rawParagrafCount = (raw.match(/class="paragraf"/g) || []).length
  const dbParagrafCount = (db.match(/class="paragraf"/g) || []).length
  const paragrafDelta = dbParagrafCount - rawParagrafCount

  // Check for regressions
  if (rawParagrafCount > 0 && dbParagrafCount === 0) {
    issues.push('LOST all paragraf anchors')
  }
  if (paragrafDelta < -2) {
    issues.push(`Lost ${Math.abs(paragrafDelta)} paragraf anchors`)
  }
  if (!dbHasWrapper) {
    issues.push('Missing article wrapper in DB')
  }

  // Check for partial normalization
  if (dbHasWrapper && dbOldBold) {
    issues.push('Still has old <b>§</b> format')
  }
  if (dbHasWrapper && dbOldNameK) {
    issues.push('Still has old <a name="K.."> format')
  }

  // Has § content but no h3.paragraph
  const hasSectionStructure = /class="paragraf"/.test(db)
  if (hasSectionStructure && !db.includes('class="paragraph"')) {
    issues.push('Has paragraf but missing h3.paragraph wrapper')
  }

  let verdict: CompareResult['verdict'] = 'GOOD'
  if (issues.some((i) => i.includes('LOST') || i.includes('Missing article'))) {
    verdict = 'REGRESSION'
  } else if (issues.length > 0) {
    verdict = 'PARTIAL'
  }

  return {
    addedWrapper,
    addedLovhead,
    addedBody,
    addedKapitel,
    addedParagraph,
    addedPText,
    addedFooter,
    removedOldBold,
    removedOldNameK,
    rawParagrafCount,
    dbParagrafCount,
    paragrafDelta,
    verdict,
    issues,
  }
}

async function main() {
  // Pick 100 random SFS laws spread across sizes
  const docs = await prisma.$queryRaw<any[]>`
    WITH ranked AS (
      SELECT document_number, LENGTH(html_content) as html_len,
        NTILE(10) OVER (ORDER BY LENGTH(html_content)) as decile
      FROM legal_documents
      WHERE content_type = 'SFS_LAW'
        AND html_content IS NOT NULL
        AND LENGTH(html_content) > 100
    )
    SELECT * FROM (
      SELECT document_number, html_len, decile,
        ROW_NUMBER() OVER (PARTITION BY decile ORDER BY RANDOM()) as rn
      FROM ranked
    ) sub
    WHERE rn <= 10
    ORDER BY decile, html_len
  `

  console.log(`Sampling ${docs.length} SFS laws across size deciles...\n`)

  const results: CompareResult[] = []
  let fetchErrors = 0

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]
    process.stdout.write(
      `[${i + 1}/${docs.length}] ${doc.document_number} (${(Number(doc.html_len) / 1024).toFixed(1)} KB)... `
    )

    // Get DB version
    const dbDoc = await prisma.legalDocument.findFirst({
      where: { document_number: doc.document_number },
      select: { html_content: true },
    })

    if (!dbDoc?.html_content) {
      console.log('SKIP (no DB html)')
      continue
    }

    // Fetch raw from Riksdag
    await sleep(250) // Rate limit
    const raw = await fetchRaw(doc.document_number)

    if (!raw) {
      fetchErrors++
      console.log('SKIP (API fetch failed)')
      results.push({
        docNum: doc.document_number,
        size: Number(doc.html_len),
        addedWrapper: false,
        addedLovhead: false,
        addedBody: false,
        addedKapitel: false,
        addedParagraph: false,
        addedPText: false,
        addedFooter: false,
        removedOldBold: false,
        removedOldNameK: false,
        rawParagrafCount: 0,
        dbParagrafCount: 0,
        paragrafDelta: 0,
        verdict: 'SKIP',
        issues: ['API fetch failed'],
      })
      continue
    }

    const result = compare(raw, dbDoc.html_content)
    const full: CompareResult = {
      docNum: doc.document_number,
      size: Number(doc.html_len),
      ...result,
    }
    results.push(full)

    const issueStr = result.issues.length
      ? ` [${result.issues.join(', ')}]`
      : ''
    console.log(`${result.verdict}${issueStr}`)
  }

  // Summary
  const tested = results.filter((r) => r.verdict !== 'SKIP')
  const good = tested.filter((r) => r.verdict === 'GOOD')
  const partial = tested.filter((r) => r.verdict === 'PARTIAL')
  const regression = tested.filter((r) => r.verdict === 'REGRESSION')
  const skipped = results.filter((r) => r.verdict === 'SKIP')

  console.log(`\n${'='.repeat(70)}`)
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Tested:     ${tested.length}`)
  console.log(
    `GOOD:       ${good.length} (${((good.length / tested.length) * 100).toFixed(1)}%)`
  )
  console.log(
    `PARTIAL:    ${partial.length} (${((partial.length / tested.length) * 100).toFixed(1)}%)`
  )
  console.log(`REGRESSION: ${regression.length}`)
  console.log(`Skipped:    ${skipped.length} (API fetch failures)`)

  // What did normalization add?
  const addedCounts = {
    wrapper: tested.filter((r) => r.addedWrapper).length,
    lovhead: tested.filter((r) => r.addedLovhead).length,
    body: tested.filter((r) => r.addedBody).length,
    kapitel: tested.filter((r) => r.addedKapitel).length,
    paragraph: tested.filter((r) => r.addedParagraph).length,
    pText: tested.filter((r) => r.addedPText).length,
    footer: tested.filter((r) => r.addedFooter).length,
    removedOldBold: tested.filter((r) => r.removedOldBold).length,
    removedOldNameK: tested.filter((r) => r.removedOldNameK).length,
  }

  console.log(
    '\nNormalization improvements (how many docs gained each feature):'
  )
  for (const [key, count] of Object.entries(addedCounts)) {
    console.log(`  ${key.padEnd(20)} ${count}/${tested.length}`)
  }

  // Paragraf delta
  const deltas = tested.filter((r) => r.rawParagrafCount > 0)
  const avgDelta =
    deltas.length > 0
      ? deltas.reduce((s, r) => s + r.paragrafDelta, 0) / deltas.length
      : 0
  console.log(
    `\nParagraf anchor delta (avg): ${avgDelta.toFixed(1)} (positive = normalizer added more)`
  )

  // Show issues
  if (partial.length > 0) {
    console.log('\nPARTIAL docs:')
    for (const r of partial) {
      console.log(`  ${r.docNum}: ${r.issues.join(', ')}`)
    }
  }
  if (regression.length > 0) {
    console.log('\nREGRESSION docs:')
    for (const r of regression) {
      console.log(`  ${r.docNum}: ${r.issues.join(', ')}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
