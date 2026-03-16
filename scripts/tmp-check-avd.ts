import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check SFS 2010:110 for avdelning structure
  const doc = await prisma.legalDocument.findUnique({
    where: { document_number: 'SFS 2010:110' },
    select: { html_content: true },
  })
  const html = doc?.html_content || ''
  console.log(
    'Has section.avdelning:',
    html.includes('section class="avdelning"')
  )
  console.log('Has avdelning-rubrik:', html.includes('avdelning-rubrik'))

  // Find a law that actually has avdelningar
  const withAvd = await prisma.$queryRaw<
    Array<{ document_number: string; title: string }>
  >`
    SELECT document_number, title
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND html_content LIKE '%section class="avdelning"%'
    LIMIT 5
  `
  console.log('\nLaws with avdelningar:')
  for (const l of withAvd) {
    console.log(`  ${l.document_number} — ${l.title?.substring(0, 60)}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
