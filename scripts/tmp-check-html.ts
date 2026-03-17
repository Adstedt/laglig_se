import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // How many have chapter references in text but no section.kapitel wrapper?
  const hasKapText = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%kap.%' AND html_content NOT LIKE '%section class="kapitel"%'`
  )
  console.log(
    'Has "kap." in text but NO section.kapitel:',
    Number(hasKapText[0]?.count)
  )

  // How many have h2 chapter headings like "1 kap." but no section.kapitel?
  const hasH2Kap = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%kapitel-rubrik%'`
  )
  console.log('Has h2.kapitel-rubrik:', Number(hasH2Kap[0]?.count))

  // How many have _K in their IDs (chapter-based semantic IDs)?
  const hasKIds = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%_K%_P%'`
  )
  console.log('Has _K*_P* semantic IDs (chaptered):', Number(hasKIds[0]?.count))

  // How many have only _P IDs (flat semantic IDs)?
  const hasPIds = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%_P%' AND html_content NOT LIKE '%_K%_P%'`
  )
  console.log('Has _P* but NOT _K*_P* (flat docs):', Number(hasPIds[0]?.count))

  // Sample: doc with "1 kap." text but no section.kapitel
  const samples = await prisma.$queryRawUnsafe<any[]>(
    `SELECT document_number, LEFT(html_content, 600) as preview FROM legal_documents WHERE content_type = 'SFS_LAW' AND html_content LIKE '%1 kap.%' AND html_content NOT LIKE '%section class="kapitel"%' AND html_content LIKE '%article class="legal-document"%' LIMIT 3`
  )
  console.log(
    `\n=== SAMPLE: Has "1 kap." but no section.kapitel (${samples.length}) ===`
  )
  for (const d of samples) {
    console.log(`\n${d.document_number}:`)
    console.log(d.preview)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
