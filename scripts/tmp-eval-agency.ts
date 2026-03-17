import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { validateCanonicalJson } from '../lib/transforms/validate-document-json'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  // Get a variety of agency docs
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'AGENCY_REGULATION',
      html_content: { not: null },
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
    },
    take: 200,
  })

  console.log(`Found ${docs.length} agency docs with HTML`)

  // Categorize by prefix
  const byPrefix: Record<string, typeof docs> = {}
  for (const d of docs) {
    const prefix = d.document_number.match(/^[A-ZÄÖÅa-zäöå-]+/)?.[0] || 'OTHER'
    if (!byPrefix[prefix]) byPrefix[prefix] = []
    byPrefix[prefix].push(d)
  }

  console.log('\nBy prefix:')
  for (const [prefix, arr] of Object.entries(byPrefix)) {
    console.log(`  ${prefix}: ${arr.length}`)
  }

  // Pick diverse samples: 2 AFS (chaptered + flat), 1 from each other prefix
  const picks: typeof docs = []

  // AFS — one large chaptered, one small
  const afs = byPrefix['AFS'] || []
  const afsLarge = afs.find((d) => (d.html_content?.length || 0) > 30000)
  const afsSmall = afs.find(
    (d) =>
      (d.html_content?.length || 0) > 2000 &&
      (d.html_content?.length || 0) < 15000
  )
  if (afsLarge) picks.push(afsLarge)
  if (afsSmall) picks.push(afsSmall)

  // One from each other prefix
  for (const [prefix, arr] of Object.entries(byPrefix)) {
    if (prefix === 'AFS') continue
    // Pick one with decent content
    const pick = arr.find((d) => (d.html_content?.length || 0) > 3000) || arr[0]
    if (pick) picks.push(pick)
  }

  console.log(`\nSelected ${picks.length} docs for eval:`)
  for (const d of picks) {
    console.log(
      `  ${d.document_number} — ${d.title?.substring(0, 60)} (${d.html_content?.length || 0} bytes)`
    )
  }

  fs.mkdirSync('data/parser-eval/agency', { recursive: true })

  const results: Array<{
    docNum: string
    title: string | null
    valid: boolean
    errors: string[]
    chapters: number
    paragrafer: number
    stycken: number
    listItems: number
    withAmended: number
    withHeading: number
    allmantRad: number
    tables: number
  }> = []

  for (const doc of picks) {
    if (!doc.html_content) continue

    const json = parseCanonicalHtml(doc.html_content, {
      sfsNumber: doc.document_number,
      documentType: 'AGENCY_REGULATION',
    })

    const validation = validateCanonicalJson(json)

    const safeName = doc.document_number
      .replace(/[:\s]/g, '-')
      .replace(/[ÄÅÖäåö]/g, 'x')
      .toLowerCase()
    fs.writeFileSync(
      `data/parser-eval/agency/${safeName}.json`,
      JSON.stringify(json, null, 2)
    )

    let totalP = 0
    let totalS = 0
    let listItems = 0
    let withAmended = 0
    let withHeading = 0
    let allmantRad = 0
    let tables = 0

    const allChapters = json.divisions
      ? json.divisions.flatMap((d) => d.chapters)
      : json.chapters

    for (const ch of allChapters) {
      for (const p of ch.paragrafer) {
        totalP++
        if (p.amendedBy) withAmended++
        if (p.heading) withHeading++
        for (const s of p.stycken) {
          totalS++
          if (s.role === 'LIST_ITEM') listItems++
          if (s.role === 'ALLMANT_RAD') allmantRad++
          if (s.role === 'TABLE') tables++
        }
      }
    }

    results.push({
      docNum: doc.document_number,
      title: json.title,
      valid: validation.valid,
      errors: validation.errors,
      chapters: allChapters.length,
      paragrafer: totalP,
      stycken: totalS,
      listItems,
      withAmended,
      withHeading,
      allmantRad,
      tables,
    })

    const status = validation.valid ? 'OK' : 'FAIL'
    console.log(
      `${status} ${doc.document_number} — ${allChapters.length} ch, ${totalP} §, ${totalS} stk, ${allmantRad} allm, ${tables} tbl`
    )
    if (!validation.valid) {
      for (const e of validation.errors.slice(0, 3)) {
        console.log(`  ERROR: ${e}`)
      }
    }
  }

  console.log('\n' + '='.repeat(130))
  console.log('SUMMARY')
  console.log('='.repeat(130))
  console.log(
    'Doc'.padEnd(22),
    'Valid'.padEnd(6),
    'Ch'.padEnd(5),
    '§'.padEnd(6),
    'Stk'.padEnd(6),
    'List'.padEnd(6),
    'Allm'.padEnd(6),
    'Tbl'.padEnd(5),
    'Hdg'.padEnd(5),
    'Amnd'.padEnd(6),
    'Title'
  )
  console.log('-'.repeat(130))
  for (const r of results) {
    console.log(
      r.docNum.padEnd(22),
      (r.valid ? 'OK' : 'FAIL').padEnd(6),
      String(r.chapters).padEnd(5),
      String(r.paragrafer).padEnd(6),
      String(r.stycken).padEnd(6),
      String(r.listItems).padEnd(6),
      String(r.allmantRad).padEnd(6),
      String(r.tables).padEnd(5),
      String(r.withHeading).padEnd(5),
      String(r.withAmended).padEnd(6),
      (r.title || '').substring(0, 45)
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
