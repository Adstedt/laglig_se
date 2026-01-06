import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== LegalDocument Table Validation ===\n')

  // 1. Count by content_type
  const allDocs = await prisma.legalDocument.findMany({
    select: { content_type: true }
  })
  const byType = new Map<string, number>()
  allDocs.forEach(d => byType.set(d.content_type, (byType.get(d.content_type) || 0) + 1))
  console.log('1. Records by content_type:')
  ;[...byType.entries()].sort((a, b) => b[1] - a[1]).forEach(([type, count]) =>
    console.log(`   ${type}: ${count}`)
  )

  // 2. Check for duplicate document_numbers
  const docNumCounts = new Map<string, number>()
  allDocs.forEach(d => {
    const doc = d as { document_number?: string }
    if (doc.document_number) {
      docNumCounts.set(doc.document_number, (docNumCounts.get(doc.document_number) || 0) + 1)
    }
  })
  // Re-fetch with document_number
  const allDocsWithNum = await prisma.legalDocument.findMany({
    select: { document_number: true, slug: true }
  })
  const docNums = new Map<string, number>()
  const slugs = new Map<string, number>()
  allDocsWithNum.forEach(d => {
    docNums.set(d.document_number, (docNums.get(d.document_number) || 0) + 1)
    slugs.set(d.slug, (slugs.get(d.slug) || 0) + 1)
  })
  const dupeDocNums = [...docNums.entries()].filter(([_, c]) => c > 1)
  console.log('\n2. Duplicate document_numbers:', dupeDocNums.length)
  dupeDocNums.slice(0, 5).forEach(([num, count]) => console.log(`   ${num}: ${count}`))

  // 3. Check for duplicate slugs
  const dupeSlugs = [...slugs.entries()].filter(([_, c]) => c > 1)
  console.log('\n3. Duplicate slugs:', dupeSlugs.length)
  dupeSlugs.slice(0, 5).forEach(([slug, count]) => console.log(`   ${slug}: ${count}`))

  // 4. Check for null/empty required fields
  const nullChecks = await prisma.legalDocument.count({
    where: {
      OR: [
        { document_number: null },
        { title: null },
        { slug: null },
        { content_type: null }
      ]
    }
  })
  console.log('\n4. Records with null required fields:', nullChecks)

  // 5. SFS_AMENDMENT specific checks
  const amendmentsWithoutMeta = await prisma.legalDocument.count({
    where: {
      content_type: 'SFS_AMENDMENT',
      metadata: { equals: null }
    }
  })
  console.log('\n5. SFS_AMENDMENT without metadata:', amendmentsWithoutMeta)

  // 6. Total counts
  const total = await prisma.legalDocument.count()
  console.log('\n6. Total LegalDocument records:', total)

  console.log('\n=== Validation Complete ===')
}
main().finally(() => prisma.$disconnect())
