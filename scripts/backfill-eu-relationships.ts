/* eslint-disable no-console */
/**
 * Backfill relationship data for existing EU documents
 *
 * Fetches cites, legal_basis, amended_by, and corrected_by relationships
 * from EUR-Lex SPARQL API and updates the database.
 */

import { PrismaClient } from '@prisma/client'
import { fetchDocumentRelationships } from '../lib/external/eurlex'

const BATCH_SIZE = 50 // SPARQL query batch size
const DELAY_BETWEEN_BATCHES = 500 // ms

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const prisma = new PrismaClient()
  const startTime = Date.now()

  try {
    // Get all CELEX numbers
    console.log('Fetching all EU document CELEX numbers...')
    const docs = await prisma.euDocument.findMany({
      select: { celex_number: true },
    })
    const celexNumbers = docs.map((d) => d.celex_number)
    console.log(`Found ${celexNumbers.length} documents to process\n`)

    let totalUpdated = 0
    let totalFailed = 0
    let totalWithData = 0
    let totalCites = 0
    let totalLegalBasis = 0
    let totalAmendedBy = 0
    let totalCorrectedBy = 0

    // Process in batches
    const totalBatches = Math.ceil(celexNumbers.length / BATCH_SIZE)

    for (let i = 0; i < celexNumbers.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const batch = celexNumbers.slice(i, i + BATCH_SIZE)

      console.log(
        `[${batchNum}/${totalBatches}] Processing ${batch.length} documents...`
      )

      try {
        const relationships = await fetchDocumentRelationships(batch)

        let batchUpdated = 0
        let batchWithData = 0

        for (const [celex, rel] of relationships) {
          const hasData =
            rel.citesCelex.length > 0 ||
            rel.legalBasisCelex.length > 0 ||
            rel.amendedByCelex.length > 0 ||
            rel.correctedByCelex.length > 0

          if (hasData) {
            batchWithData++
            totalCites += rel.citesCelex.length
            totalLegalBasis += rel.legalBasisCelex.length
            totalAmendedBy += rel.amendedByCelex.length
            totalCorrectedBy += rel.correctedByCelex.length

            try {
              await prisma.euDocument.update({
                where: { celex_number: celex },
                data: {
                  cites_celex: rel.citesCelex,
                  legal_basis_celex: rel.legalBasisCelex,
                  amended_by_celex: rel.amendedByCelex,
                  corrected_by_celex: rel.correctedByCelex,
                },
              })
              batchUpdated++
            } catch {
              totalFailed++
            }
          }
        }

        totalUpdated += batchUpdated
        totalWithData += batchWithData

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        const progress = (
          ((i + batch.length) / celexNumbers.length) *
          100
        ).toFixed(1)
        console.log(
          `   Updated ${batchUpdated}/${batchWithData} with data (${progress}% done, ${elapsed}s elapsed)`
        )
      } catch (error) {
        console.error(
          `   ❌ Batch failed:`,
          error instanceof Error ? error.message : error
        )
        totalFailed += batch.length
      }

      await sleep(DELAY_BETWEEN_BATCHES)
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('\n' + '='.repeat(60))
    console.log('BACKFILL COMPLETE')
    console.log('='.repeat(60))
    console.log(`Total documents:     ${celexNumbers.length}`)
    console.log(`With relationship data: ${totalWithData}`)
    console.log(`Successfully updated:   ${totalUpdated}`)
    console.log(`Failed:                 ${totalFailed}`)
    console.log('')
    console.log('Relationship totals:')
    console.log(`  - Citations:      ${totalCites}`)
    console.log(`  - Legal basis:    ${totalLegalBasis}`)
    console.log(`  - Amended by:     ${totalAmendedBy}`)
    console.log(`  - Corrected by:   ${totalCorrectedBy}`)
    console.log('')
    console.log(`Duration: ${duration}s`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
