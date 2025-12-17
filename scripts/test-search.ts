import { prisma } from '../lib/prisma'

async function test() {
  // Test 1: Sök på "personuppgift"
  const result1 = await prisma.$queryRaw<
    {
      id: string
      title: string
      document_number: string
      content_type: string
    }[]
  >`
    SELECT id, title, document_number, content_type
    FROM legal_documents
    WHERE search_vector @@ plainto_tsquery('pg_catalog.swedish', 'personuppgift')
    LIMIT 5
  `
  console.log('Sökresultat för "personuppgift":')
  result1.forEach((r) =>
    console.log('-', r.content_type, r.document_number, r.title)
  )

  // Test 2: Sök på "GDPR"
  const result2 = await prisma.$queryRaw<
    {
      id: string
      title: string
      document_number: string
      content_type: string
    }[]
  >`
    SELECT id, title, document_number, content_type
    FROM legal_documents
    WHERE search_vector @@ plainto_tsquery('pg_catalog.swedish', 'GDPR')
    LIMIT 5
  `
  console.log('\nSökresultat för "GDPR":')
  result2.forEach((r) =>
    console.log('-', r.content_type, r.document_number, r.title)
  )

  // Test 3: Kolla antal med summary
  const withSummary = await prisma.legalDocument.count({
    where: { summary: { not: null } },
  })
  const total = await prisma.legalDocument.count()
  console.log('\nAntal dokument med summary:', withSummary, 'av', total)
}

test().finally(() => prisma.$disconnect())
