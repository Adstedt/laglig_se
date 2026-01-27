/**
 * Backfill legislative_refs table from existing json_content
 * Story 2.29: Populate the new table for existing processed amendments
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient, LegislativeRefType } from '@prisma/client'

const prisma = new PrismaClient()

interface LegislativeReference {
  type: string
  reference: string
  year: string
  number: string
}

interface JsonContent {
  legislativeReferences?: LegislativeReference[]
}

const refTypeMap: Record<string, LegislativeRefType> = {
  prop: 'PROP',
  bet: 'BET',
  rskr: 'RSKR',
  sou: 'SOU',
  ds: 'DS',
}

async function main() {
  // Get all amendments with json_content
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      json_content: { not: null },
    },
    select: {
      id: true,
      document_number: true,
      json_content: true,
    },
  })

  console.log(`Found ${docs.length} amendments with json_content\n`)

  let totalRefs = 0
  let docsWithRefs = 0

  for (const doc of docs) {
    const json = doc.json_content as JsonContent | null
    const refs = json?.legislativeReferences || []

    if (refs.length === 0) continue

    // Delete existing refs (in case of re-run)
    await prisma.legislativeRef.deleteMany({
      where: { legal_document_id: doc.id },
    })

    // Insert new refs
    await prisma.legislativeRef.createMany({
      data: refs.map((ref) => ({
        legal_document_id: doc.id,
        ref_type: refTypeMap[ref.type] || 'PROP',
        reference: ref.reference,
        year: ref.year,
        number: ref.number,
      })),
      skipDuplicates: true,
    })

    totalRefs += refs.length
    docsWithRefs++

    if (docsWithRefs % 20 === 0) {
      console.log(`  Processed ${docsWithRefs} docs with refs...`)
    }
  }

  // Verify
  const totalInDb = await prisma.legislativeRef.count()

  console.log('\n' + '='.repeat(60))
  console.log('BACKFILL COMPLETE')
  console.log('='.repeat(60))
  console.log(`Documents processed: ${docs.length}`)
  console.log(`Documents with refs: ${docsWithRefs}`)
  console.log(`Total refs inserted: ${totalRefs}`)
  console.log(`Verified in DB: ${totalInDb}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
