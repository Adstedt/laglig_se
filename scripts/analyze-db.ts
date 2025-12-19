/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function analyze() {
  // SFS Law stats
  const sfsCount = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  const sfsAmendCount = await prisma.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT' },
  })

  // Cross references
  const crossRefCount = await prisma.crossReference.count()
  const crossRefByType = await prisma.crossReference.groupBy({
    by: ['reference_type'],
    _count: true,
  })

  // Amendments
  const amendmentCount = await prisma.amendment.count()

  // Document versions
  const versionCount = await prisma.documentVersion.count()

  // Change events
  const changeEventCount = await prisma.changeEvent.count()

  // EU documents
  const euRegCount = await prisma.legalDocument.count({
    where: { content_type: 'EU_REGULATION' },
  })
  const euDirCount = await prisma.legalDocument.count({
    where: { content_type: 'EU_DIRECTIVE' },
  })

  // EU with relationships stored
  const euWithCites = await prisma.euDocument.count({
    where: { cites_celex: { isEmpty: false } },
  })
  const euWithLegalBasis = await prisma.euDocument.count({
    where: { legal_basis_celex: { isEmpty: false } },
  })

  // Sample an EU document with relationships
  const sampleEu = await prisma.euDocument.findFirst({
    where: { cites_celex: { isEmpty: false } },
    include: { document: { select: { document_number: true, title: true } } },
  })

  // Sample a cross reference
  const sampleCrossRef = await prisma.crossReference.findFirst({
    include: {
      source_document: { select: { document_number: true } },
      target_document: { select: { document_number: true } },
    },
  })

  console.log('=== DATABASE ANALYSIS ===')
  console.log('')
  console.log('SFS Laws:', sfsCount)
  console.log('SFS Amendments:', sfsAmendCount)
  console.log('')
  console.log('Cross References:', crossRefCount)
  console.log('By Type:', JSON.stringify(crossRefByType, null, 2))
  console.log('')
  console.log('Amendments (tracked):', amendmentCount)
  console.log('Document Versions:', versionCount)
  console.log('Change Events:', changeEventCount)
  console.log('')
  console.log('EU Regulations:', euRegCount)
  console.log('EU Directives:', euDirCount)
  console.log('EU with cites_celex:', euWithCites)
  console.log('EU with legal_basis_celex:', euWithLegalBasis)
  console.log('')
  console.log('=== SAMPLE EU DOCUMENT WITH CITATIONS ===')
  if (sampleEu) {
    console.log('CELEX:', sampleEu.celex_number)
    console.log('Title:', sampleEu.document.title?.substring(0, 80))
    console.log('Cites:', sampleEu.cites_celex.slice(0, 5))
    console.log('Legal Basis:', sampleEu.legal_basis_celex)
  }
  console.log('')
  console.log('=== SAMPLE CROSS REFERENCE ===')
  if (sampleCrossRef) {
    console.log('Type:', sampleCrossRef.reference_type)
    console.log('Source:', sampleCrossRef.source_document.document_number)
    console.log('Target:', sampleCrossRef.target_document.document_number)
    console.log('Context:', sampleCrossRef.context?.substring(0, 100))
  }

  await prisma.$disconnect()
}

analyze()
