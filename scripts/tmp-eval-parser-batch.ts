import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { validateCanonicalJson } from '../lib/transforms/validate-document-json'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  // Find 5 large laws (most chapters)
  const largeLaws = await prisma.$queryRaw<
    Array<{ document_number: string; title: string; ch_count: number }>
  >`
    SELECT document_number, title,
      (LENGTH(html_content) - LENGTH(REPLACE(html_content, 'class="kapitel"', ''))) / LENGTH('class="kapitel"') as ch_count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND html_content IS NOT NULL
      AND LENGTH(html_content) > 50000
      AND document_number NOT LIKE 'HIST:%'
    ORDER BY LENGTH(html_content) DESC
    LIMIT 20
  `

  // Find flat laws (no chapters) - small ones
  const flatLaws = await prisma.$queryRaw<
    Array<{ document_number: string; title: string; len: number }>
  >`
    SELECT document_number, title, LENGTH(html_content) as len
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND html_content IS NOT NULL
      AND html_content NOT LIKE '%class="kapitel"%'
      AND LENGTH(html_content) > 1000
      AND LENGTH(html_content) < 20000
    ORDER BY RANDOM()
    LIMIT 10
  `

  // Find small chaptered laws
  const smallLaws = await prisma.$queryRaw<
    Array<{ document_number: string; title: string; len: number }>
  >`
    SELECT document_number, title, LENGTH(html_content) as len
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND html_content IS NOT NULL
      AND html_content LIKE '%class="kapitel"%'
      AND LENGTH(html_content) BETWEEN 5000 AND 30000
    ORDER BY RANDOM()
    LIMIT 10
  `

  console.log('=== LARGE LAW CANDIDATES ===')
  for (const l of largeLaws.slice(0, 8)) {
    console.log(
      `  ${l.document_number} — ${l.title?.substring(0, 60)} (chapters: ~${l.ch_count})`
    )
  }

  console.log('\n=== FLAT LAW CANDIDATES ===')
  for (const l of flatLaws.slice(0, 6)) {
    console.log(
      `  ${l.document_number} — ${l.title?.substring(0, 60)} (${l.len} bytes)`
    )
  }

  console.log('\n=== SMALL CHAPTERED CANDIDATES ===')
  for (const l of smallLaws.slice(0, 6)) {
    console.log(
      `  ${l.document_number} — ${l.title?.substring(0, 60)} (${l.len} bytes)`
    )
  }

  // Pick 5 large + 3 flat + 2 small chaptered + the already-done 1977:1160
  const picks = [
    ...largeLaws.slice(0, 5).map((l) => l.document_number),
    ...flatLaws.slice(0, 3).map((l) => l.document_number),
    ...smallLaws.slice(0, 2).map((l) => l.document_number),
  ]

  console.log('\n=== SELECTED ===')
  console.log(picks.join(', '))

  // Process each
  const results: Array<{
    docNum: string
    title: string | null
    valid: boolean
    errors: string[]
    chapters: number
    divisions: number | null
    paragrafer: number
    stycken: number
    listItems: number
    withAmended: number
    hasTransitions: boolean
    hasAppendices: boolean
  }> = []

  for (const docNum of picks) {
    const doc = await prisma.legalDocument.findUnique({
      where: { document_number: docNum },
      select: { html_content: true, document_number: true, title: true },
    })
    if (!doc?.html_content) {
      console.log(`SKIP: ${docNum} — no HTML`)
      continue
    }

    const json = parseCanonicalHtml(doc.html_content, {
      sfsNumber: docNum,
      documentType: 'SFS_LAW',
    })

    const validation = validateCanonicalJson(json)

    // Save JSON
    const safeName = docNum.replace(/[:\s]/g, '-').toLowerCase()
    const outPath = `data/parser-eval/${safeName}.json`
    fs.mkdirSync('data/parser-eval', { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(json, null, 2))

    // Stats
    let totalP = 0
    let totalS = 0
    let listItems = 0
    let withAmended = 0

    const allChapters = json.divisions
      ? json.divisions.flatMap((d) => d.chapters)
      : json.chapters

    for (const ch of allChapters) {
      for (const p of ch.paragrafer) {
        totalP++
        if (p.amendedBy) withAmended++
        for (const s of p.stycken) {
          totalS++
          if (s.role === 'LIST_ITEM') listItems++
        }
      }
    }

    results.push({
      docNum,
      title: json.title,
      valid: validation.valid,
      errors: validation.errors,
      chapters: allChapters.length,
      divisions: json.divisions?.length ?? null,
      paragrafer: totalP,
      stycken: totalS,
      listItems,
      withAmended,
      hasTransitions: json.transitionProvisions !== null,
      hasAppendices: json.appendices !== null,
    })

    console.log(
      `${validation.valid ? 'OK' : 'FAIL'} ${docNum} — ${allChapters.length} ch, ${totalP} §, ${totalS} stycken`
    )
    if (!validation.valid) {
      for (const e of validation.errors.slice(0, 3)) {
        console.log(`  ERROR: ${e}`)
      }
    }
  }

  // Summary table
  console.log('\n' + '='.repeat(120))
  console.log('SUMMARY')
  console.log('='.repeat(120))
  console.log(
    'Doc'.padEnd(20),
    'Valid'.padEnd(6),
    'Div'.padEnd(5),
    'Ch'.padEnd(5),
    '§'.padEnd(6),
    'Stk'.padEnd(6),
    'List'.padEnd(6),
    'Amnd'.padEnd(6),
    'Trans'.padEnd(6),
    'App'.padEnd(5),
    'Title'
  )
  console.log('-'.repeat(120))
  for (const r of results) {
    console.log(
      r.docNum.padEnd(20),
      (r.valid ? 'OK' : 'FAIL').padEnd(6),
      String(r.divisions ?? '-').padEnd(5),
      String(r.chapters).padEnd(5),
      String(r.paragrafer).padEnd(6),
      String(r.stycken).padEnd(6),
      String(r.listItems).padEnd(6),
      String(r.withAmended).padEnd(6),
      (r.hasTransitions ? 'Y' : '-').padEnd(6),
      (r.hasAppendices ? 'Y' : '-').padEnd(5),
      (r.title || '').substring(0, 45)
    )
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
