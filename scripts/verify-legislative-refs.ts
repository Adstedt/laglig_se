import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Count by type
  const byType = await prisma.legislativeRef.groupBy({
    by: ['ref_type'],
    _count: { id: true },
  })

  console.log('=== Legislative Refs by Type ===')
  for (const t of byType) {
    console.log(`  ${t.ref_type}: ${t._count.id}`)
  }

  // Sample query: Find all amendments referencing a specific prop
  const prop = 'Prop. 2024/25:59'
  const amendments = await prisma.legislativeRef.findMany({
    where: { reference: prop },
    include: { legal_document: { select: { document_number: true, title: true } } },
  })

  console.log(`\n=== Amendments referencing ${prop} ===`)
  for (const a of amendments) {
    console.log(`  ${a.legal_document.document_number}: ${a.legal_document.title?.substring(0, 50)}`)
  }

  // Unique references
  const uniqueProps = await prisma.legislativeRef.findMany({
    where: { ref_type: 'PROP' },
    distinct: ['reference'],
    select: { reference: true, year: true },
  })

  console.log(`\n=== Unique Propositions (${uniqueProps.length}) ===`)
  uniqueProps.slice(0, 10).forEach((p) => console.log(`  ${p.reference}`))
  if (uniqueProps.length > 10) console.log(`  ... and ${uniqueProps.length - 10} more`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
