/* eslint-disable no-console */
/**
 * Test updating relationships for existing documents
 */

import { PrismaClient } from '@prisma/client'
import { fetchDocumentRelationships } from '../lib/external/eurlex'

async function test() {
  const prisma = new PrismaClient()

  try {
    // Get a few 2020 documents that exist
    const docs = await prisma.euDocument.findMany({
      where: { celex_number: { startsWith: '32020' } },
      take: 10,
      select: { celex_number: true },
    })

    const celexNumbers = docs.map((d) => d.celex_number)
    console.log('Testing with:', celexNumbers.join(', '))

    console.log('\nFetching relationships from EUR-Lex SPARQL...')
    const startTime = Date.now()
    const relationships = await fetchDocumentRelationships(celexNumbers)
    console.log(`Fetched in ${Date.now() - startTime}ms`)

    let updated = 0
    for (const [celex, rel] of relationships) {
      const hasData =
        rel.citesCelex.length > 0 ||
        rel.legalBasisCelex.length > 0 ||
        rel.amendedByCelex.length > 0 ||
        rel.correctedByCelex.length > 0

      if (hasData) {
        console.log(`\nUpdating ${celex}:`)
        console.log(`  - ${rel.citesCelex.length} citations (vanity)`)
        console.log(`  - ${rel.legalBasisCelex.length} legal basis`)
        console.log(`  - ${rel.amendedByCelex.length} amended by`)
        console.log(`  - ${rel.correctedByCelex.length} corrected by`)

        await prisma.euDocument.update({
          where: { celex_number: celex },
          data: {
            cites_celex: rel.citesCelex,
            legal_basis_celex: rel.legalBasisCelex,
            amended_by_celex: rel.amendedByCelex,
            corrected_by_celex: rel.correctedByCelex,
          },
        })
        updated++
      }
    }

    console.log(`\n✅ Updated ${updated} documents`)

    // Verify
    console.log('\n=== Verification ===')
    const withCites = await prisma.euDocument.count({
      where: { cites_celex: { isEmpty: false } },
    })
    console.log(`Documents with citations: ${withCites}`)

    // Show a sample
    const sample = await prisma.euDocument.findFirst({
      where: { cites_celex: { isEmpty: false } },
      select: { celex_number: true, cites_celex: true },
    })
    if (sample) {
      console.log(`\nSample: ${sample.celex_number}`)
      console.log(
        `  Citations: ${sample.cites_celex.slice(0, 5).join(', ')}${sample.cites_celex.length > 5 ? '...' : ''}`
      )
    }
  } finally {
    await prisma.$disconnect()
  }
}

test().catch(console.error)
