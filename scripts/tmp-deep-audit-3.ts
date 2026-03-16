import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Among the 2,548 with wrapper but no class="paragraf":
  // How many have OLD Riksdag structural elements inside?

  // 1. Have old <a class="paragraf" name=... with <b>§</b> inside — raw riksdag anchors
  const hasOldParagrafAnchors = await prisma.$queryRawUnsafe<
    [{ count: bigint }]
  >(
    `SELECT COUNT(*) as count FROM legal_documents
     WHERE content_type = 'SFS_LAW'
     AND html_content LIKE '%article class="legal-document"%'
     AND html_content NOT LIKE '%class="paragraph"%'
     AND html_content LIKE '%<a class="paragraf"%'`
  )
  console.log(
    `Old <a class="paragraf"> anchors (needs re-norm): ${Number(hasOldParagrafAnchors[0]?.count)}`
  )

  // 2. Have old chapter anchors <a name="K1">
  const hasOldChapterAnchors = await prisma.$queryRawUnsafe<
    [{ count: bigint }]
  >(
    `SELECT COUNT(*) as count FROM legal_documents
     WHERE content_type = 'SFS_LAW'
     AND html_content LIKE '%article class="legal-document"%'
     AND html_content NOT LIKE '%class="paragraph"%'
     AND html_content LIKE '%<a name="K%'`
  )
  console.log(
    `Old <a name="K..."> chapter anchors (needs re-norm): ${Number(hasOldChapterAnchors[0]?.count)}`
  )

  // 3. Have LedParagraf class-based format
  const hasLedParagraf = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents
     WHERE content_type = 'SFS_LAW'
     AND html_content LIKE '%article class="legal-document"%'
     AND html_content NOT LIKE '%class="paragraph"%'
     AND html_content LIKE '%class="LedParagraf"%'`
  )
  console.log(
    `Has LedParagraf class (needs re-norm): ${Number(hasLedParagraf[0]?.count)}`
  )

  // 4. Have raw <div class="dok"> (historical OCR/page layout)
  const hasRawDok = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents
     WHERE content_type = 'SFS_LAW'
     AND html_content LIKE '%article class="legal-document"%'
     AND html_content NOT LIKE '%class="paragraph"%'
     AND html_content LIKE '%class="dok"%'`
  )
  console.log(
    `Has <div class="dok"> (historical/OCR docs): ${Number(hasRawDok[0]?.count)}`
  )

  // 5. Summary: how many need re-normalization?
  const needsReNorm = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents
     WHERE content_type = 'SFS_LAW'
     AND html_content LIKE '%article class="legal-document"%'
     AND html_content NOT LIKE '%class="paragraph"%'
     AND (
       html_content LIKE '%<a class="paragraf"%'
       OR html_content LIKE '%<a name="K%'
       OR html_content LIKE '%class="LedParagraf"%'
     )`
  )
  console.log(
    `\nTotal needing re-normalization (has old structural elements): ${Number(needsReNorm[0]?.count)}`
  )

  // 6. Sample a doc that needs re-norm (has old <a class="paragraf"> inside wrapper)
  const samples = await prisma.$queryRawUnsafe<any[]>(
    `SELECT document_number, title, LEFT(html_content, 1200) as preview
     FROM legal_documents
     WHERE content_type = 'SFS_LAW'
     AND html_content LIKE '%article class="legal-document"%'
     AND html_content NOT LIKE '%class="paragraph"%'
     AND html_content LIKE '%<a class="paragraf"%'
     LIMIT 2`
  )
  console.log(
    `\n=== SAMPLE: Wrapper + old <a class="paragraf"> (${samples.length}) ===`
  )
  for (const d of samples) {
    console.log(`\n${d.document_number}: ${d.title}`)
    console.log(d.preview)
  }

  // 7. Among the remaining 2,548 - those that DON'T need re-norm
  const legitimateSimple = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents
     WHERE content_type = 'SFS_LAW'
     AND html_content LIKE '%article class="legal-document"%'
     AND html_content NOT LIKE '%class="paragraph"%'
     AND html_content NOT LIKE '%<a class="paragraf"%'
     AND html_content NOT LIKE '%<a name="K%'
     AND html_content NOT LIKE '%class="LedParagraf"%'`
  )
  console.log(
    `\nLegitimately simple (no old structure, wrapper-only OK): ${Number(legitimateSimple[0]?.count)}`
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
