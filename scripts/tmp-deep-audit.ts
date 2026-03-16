import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. Total SFS_LAW docs with html_content
  const total = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW', html_content: { not: null } },
  })
  console.log(`Total SFS_LAW with html_content: ${total}`)

  // 2. Already have article.legal-document wrapper
  const hasWrapper = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%article class="legal-document"%'`
  )
  console.log(
    `Have article.legal-document wrapper: ${Number(hasWrapper[0]?.count)}`
  )

  // 3. Have section.kapitel (properly chaptered)
  const hasKapitel = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%section class="kapitel"%'`
  )
  console.log(
    `Have section.kapitel (properly chaptered): ${Number(hasKapitel[0]?.count)}`
  )

  // 4. Have actual chapter heading patterns in their structure (not just cross-references)
  // Check for h2 or h3 elements that contain " kap." pattern (chapter headings)
  const hasChapterHeading = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%kapitel-rubrik%'`
  )
  console.log(
    `Have kapitel-rubrik class (chapter headings): ${Number(hasChapterHeading[0]?.count)}`
  )

  // 5. Have wrapper + semantic IDs
  const hasSemanticIds = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%class="paragraf"%'`
  )
  console.log(
    `Have class="paragraf" anchors: ${Number(hasSemanticIds[0]?.count)}`
  )

  // 6. Have wrapper but OLD inner structure (h3 without class, or raw <b>§</b>)
  const hasOldInner = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%article class="legal-document"%' AND html_content NOT LIKE '%class="paragraf"%'`
  )
  console.log(
    `Have wrapper but NO class="paragraf" (old inner structure): ${Number(hasOldInner[0]?.count)}`
  )

  // 7. How many have the wrapper AND the new structure markers?
  const fullyCanonical = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%article class="legal-document"%' AND html_content LIKE '%class="paragraf"%' AND html_content LIKE '%class="paragraph"%'`
  )
  console.log(
    `Fully canonical (wrapper + paragraf + paragraph): ${Number(fullyCanonical[0]?.count)}`
  )

  // 8. NO wrapper at all
  const noWrapper = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content IS NOT NULL AND html_content NOT LIKE '%article class="legal-document"%'`
  )
  console.log(`NO wrapper at all: ${Number(noWrapper[0]?.count)}`)

  // 9. Sample a doc that HAS wrapper but NO paragraf class
  const samples = await prisma.$queryRawUnsafe<any[]>(
    `SELECT document_number, LEFT(html_content, 800) as preview FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%article class="legal-document"%' AND html_content NOT LIKE '%class="paragraf"%' LIMIT 3`
  )
  console.log(
    `\n=== SAMPLE: Has wrapper but NO class="paragraf" (${samples.length}) ===`
  )
  for (const d of samples) {
    console.log(`\n${d.document_number}:`)
    console.log(d.preview)
  }

  // 10. Chaptered docs: has kapitel-rubrik but no section.kapitel
  const chapNeedsWrap = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%kapitel-rubrik%' AND html_content NOT LIKE '%section class="kapitel"%'`
  )
  console.log(
    `\nHas kapitel-rubrik but NO section.kapitel: ${Number(chapNeedsWrap[0]?.count)}`
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
