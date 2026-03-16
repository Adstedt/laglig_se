import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check what the 2,548 docs without class="paragraf" look like
  // Are they simple tillkännagivanden or broken chaptered laws?

  // 1. Among the 2,548: how many have "§" in their html at all?
  const hasParagraphSign = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%article class="legal-document"%' AND html_content NOT LIKE '%class="paragraf"%' AND html_content LIKE '%§%'`
  )
  console.log(
    `No paragraf class but HAS § sign: ${Number(hasParagraphSign[0]?.count)}`
  )

  // 2. Among those, sample some that DO have § signs (potentially broken)
  const brokenSamples = await prisma.$queryRawUnsafe<any[]>(
    `SELECT document_number, title, LEFT(html_content, 1000) as preview FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%article class="legal-document"%' AND html_content NOT LIKE '%class="paragraf"%' AND html_content LIKE '%§%' LIMIT 5`
  )
  console.log(
    `\n=== SAMPLE: Has wrapper + § sign but NO paragraf class (${brokenSamples.length}) ===`
  )
  for (const d of brokenSamples) {
    console.log(`\n${d.document_number}: ${d.title}`)
    console.log(d.preview.substring(0, 600))
  }

  // 3. Among the 2,548: check title patterns
  const titlePatterns = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       CASE
         WHEN title LIKE '%Tillkännagivande%' THEN 'Tillkännagivande'
         WHEN title LIKE '%Kungörelse%' THEN 'Kungörelse'
         WHEN title LIKE '%Lag %' OR title LIKE '%lag (%' THEN 'Lag'
         WHEN title LIKE '%Förordning%' OR title LIKE '%förordning%' THEN 'Förordning'
         ELSE 'Other'
       END as doc_type,
       COUNT(*) as count
     FROM legal_documents
     WHERE content_type = 'SFS_LAW'
       AND html_content LIKE '%article class="legal-document"%'
       AND html_content NOT LIKE '%class="paragraf"%'
     GROUP BY doc_type
     ORDER BY count DESC`
  )
  console.log('\n=== Title patterns among the 2,548 ===')
  for (const p of titlePatterns) {
    console.log(`  ${p.doc_type}: ${Number(p.count)}`)
  }

  // 4. How many of the 2,548 have <b>§</b> (raw paragraph markers)
  const hasRawBold = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%article class="legal-document"%' AND html_content NOT LIKE '%class="paragraf"%' AND html_content LIKE '%<b>%§%</b>%'`
  )
  console.log(
    `\nHas raw <b>§</b> (definitely broken): ${Number(hasRawBold[0]?.count)}`
  )

  // 5. How many have <a name= (old-style anchors, pre-normalization)
  const hasOldAnchors = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%article class="legal-document"%' AND html_content NOT LIKE '%class="paragraf"%' AND html_content LIKE '%<a name=%'`
  )
  console.log(`Has <a name= (old anchors): ${Number(hasOldAnchors[0]?.count)}`)

  // 6. Truly simple docs: wrapper but no §, no <a name=, no <b>
  const trulySimple = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%article class="legal-document"%' AND html_content NOT LIKE '%class="paragraf"%' AND html_content NOT LIKE '%§%' AND html_content NOT LIKE '%<a name=%'`
  )
  console.log(
    `Truly simple (no §, no anchors): ${Number(trulySimple[0]?.count)}`
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
