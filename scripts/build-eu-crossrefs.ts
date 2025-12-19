/**
 * Build CrossReference records from EU document relationship arrays.
 *
 * This script reads the cites_celex, legal_basis_celex, and amended_by_celex arrays
 * stored on eu_documents and creates CrossReference records where both source and
 * target documents exist in the database.
 *
 * Usage: pnpm tsx scripts/build-eu-crossrefs.ts [--dry-run]
 */

import { PrismaClient, ReferenceType } from '@prisma/client'

const prisma = new PrismaClient()

const BATCH_SIZE = 100
const DRY_RUN = process.argv.includes('--dry-run')

interface RelationshipStats {
  cites: { total: number; created: number; skipped: number }
  legalBasis: { total: number; created: number; skipped: number }
  amendedBy: { total: number; created: number; skipped: number }
}

async function buildCrossReferences() {
  console.log('=== EU CrossReference Builder ===')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`)
  console.log('')

  // Get count of EU documents with relationship data
  const totalDocs = await prisma.euDocument.count({
    where: {
      OR: [
        { cites_celex: { isEmpty: false } },
        { legal_basis_celex: { isEmpty: false } },
        { amended_by_celex: { isEmpty: false } },
      ],
    },
  })

  console.log(`Found ${totalDocs} EU documents with relationship data`)

  // Build CELEX → document_id lookup map for all EU documents
  console.log('Building CELEX lookup map...')
  const allEuDocs = await prisma.euDocument.findMany({
    select: { celex_number: true, document_id: true },
  })
  const celexToDocId = new Map(
    allEuDocs.map((d) => [d.celex_number, d.document_id])
  )
  console.log(`Lookup map contains ${celexToDocId.size} CELEX numbers`)
  console.log('')

  const stats: RelationshipStats = {
    cites: { total: 0, created: 0, skipped: 0 },
    legalBasis: { total: 0, created: 0, skipped: 0 },
    amendedBy: { total: 0, created: 0, skipped: 0 },
  }

  // Process documents in batches
  let processed = 0
  let cursor: string | undefined

  while (true) {
    const batch = await prisma.euDocument.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        OR: [
          { cites_celex: { isEmpty: false } },
          { legal_basis_celex: { isEmpty: false } },
          { amended_by_celex: { isEmpty: false } },
        ],
      },
      include: {
        document: { select: { id: true, document_number: true } },
      },
      orderBy: { id: 'asc' },
    })

    if (batch.length === 0) break

    const crossRefsToCreate: {
      source_document_id: string
      target_document_id: string
      reference_type: ReferenceType
    }[] = []

    for (const euDoc of batch) {
      const sourceId = euDoc.document_id

      // Process CITES relationships
      for (const targetCelex of euDoc.cites_celex) {
        stats.cites.total++
        const targetId = celexToDocId.get(targetCelex)
        if (targetId && targetId !== sourceId) {
          crossRefsToCreate.push({
            source_document_id: sourceId,
            target_document_id: targetId,
            reference_type: 'CITES',
          })
          stats.cites.created++
        } else {
          stats.cites.skipped++
        }
      }

      // Process LEGAL_BASIS relationships
      for (const targetCelex of euDoc.legal_basis_celex) {
        stats.legalBasis.total++
        const targetId = celexToDocId.get(targetCelex)
        if (targetId && targetId !== sourceId) {
          crossRefsToCreate.push({
            source_document_id: sourceId,
            target_document_id: targetId,
            reference_type: 'LEGAL_BASIS',
          })
          stats.legalBasis.created++
        } else {
          stats.legalBasis.skipped++
        }
      }

      // Process AMENDED_BY relationships (inverse: target amends source)
      // We store as AMENDS: the amending doc → this doc
      for (const amendingCelex of euDoc.amended_by_celex) {
        stats.amendedBy.total++
        const amendingDocId = celexToDocId.get(amendingCelex)
        if (amendingDocId && amendingDocId !== sourceId) {
          // The amending document AMENDS this document
          crossRefsToCreate.push({
            source_document_id: amendingDocId,
            target_document_id: sourceId,
            reference_type: 'AMENDS',
          })
          stats.amendedBy.created++
        } else {
          stats.amendedBy.skipped++
        }
      }
    }

    // Insert batch of cross references
    if (!DRY_RUN && crossRefsToCreate.length > 0) {
      await prisma.crossReference.createMany({
        data: crossRefsToCreate,
        skipDuplicates: true,
      })
    }

    processed += batch.length
    cursor = batch[batch.length - 1].id

    // Progress update
    const pct = Math.round((processed / totalDocs) * 100)
    process.stdout.write(
      `\rProcessed ${processed}/${totalDocs} (${pct}%) - Refs queued: ${crossRefsToCreate.length}`
    )
  }

  console.log('\n')
  console.log('=== Results ===')
  console.log('')
  console.log('CITES:')
  console.log(`  Total references: ${stats.cites.total}`)
  console.log(`  Created: ${stats.cites.created}`)
  console.log(`  Skipped (target not in DB): ${stats.cites.skipped}`)
  console.log('')
  console.log('LEGAL_BASIS:')
  console.log(`  Total references: ${stats.legalBasis.total}`)
  console.log(`  Created: ${stats.legalBasis.created}`)
  console.log(`  Skipped (target not in DB): ${stats.legalBasis.skipped}`)
  console.log('')
  console.log('AMENDS (from amended_by):')
  console.log(`  Total references: ${stats.amendedBy.total}`)
  console.log(`  Created: ${stats.amendedBy.created}`)
  console.log(`  Skipped (amending doc not in DB): ${stats.amendedBy.skipped}`)
  console.log('')

  const totalCreated =
    stats.cites.created + stats.legalBasis.created + stats.amendedBy.created
  console.log(
    `Total CrossReferences ${DRY_RUN ? 'would be' : ''} created: ${totalCreated}`
  )

  // Verify final count
  if (!DRY_RUN) {
    const euCrossRefCount = await prisma.crossReference.count({
      where: {
        source_document: {
          content_type: { in: ['EU_REGULATION', 'EU_DIRECTIVE'] },
        },
      },
    })
    console.log(`\nVerification: EU CrossReferences in DB: ${euCrossRefCount}`)
  }

  await prisma.$disconnect()
}

buildCrossReferences().catch((e) => {
  console.error('Error:', e)
  prisma.$disconnect()
  process.exit(1)
})
