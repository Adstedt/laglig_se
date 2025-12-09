/* eslint-disable no-console */
/**
 * Backfill a single law for testing
 */

import { prisma } from '../lib/prisma'
import { createInitialVersion } from '../lib/sync/version-archive'
import { extractAllAmendments } from '../lib/sync/amendment-creator'

const DOC_NUMBER = process.argv[2] || 'SFS 1977:1160'

async function backfillSingle() {
  console.log(`Looking for law: ${DOC_NUMBER}`)

  const law = await prisma.legalDocument.findFirst({
    where: { document_number: { contains: DOC_NUMBER.replace('SFS ', '') } },
    select: {
      id: true,
      document_number: true,
      title: true,
      full_text: true,
      html_content: true,
      metadata: true,
    },
  })

  if (!law) {
    console.log('Law not found')
    return
  }

  console.log(`Found: ${law.title} (${law.document_number})`)
  console.log(`ID: ${law.id}`)

  // Check if already has version
  const existingVersion = await prisma.documentVersion.findFirst({
    where: { document_id: law.id },
  })

  if (existingVersion) {
    console.log('Already has version record, skipping version creation')
  } else {
    console.log('\nCreating initial version...')
    await prisma.$transaction(async (tx) => {
      const version = await createInitialVersion(tx, {
        documentId: law.id,
        fullText: law.full_text || '',
        htmlContent: law.html_content || null,
        amendmentSfs: null,
        sourceSystemdatum: null,
      })
      console.log(`Created version: ${version?.id}`)
    })
  }

  // Extract amendments
  console.log('\nExtracting amendments...')
  const amendments = await prisma.$transaction(async (tx) => {
    return await extractAllAmendments(
      tx,
      law.id,
      law.full_text || '',
      undefined
    )
  })

  console.log(`\nCreated ${amendments.length} amendments:`)
  for (const a of amendments) {
    console.log(` - ${a.amending_law_title}: ${JSON.stringify(a.affected_sections)}`)
  }

  // Verify
  const totalAmendments = await prisma.amendment.count({
    where: { base_document_id: law.id },
  })
  console.log(`\nTotal amendments for this law: ${totalAmendments}`)

  await prisma.$disconnect()
}

backfillSingle()
