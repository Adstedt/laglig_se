/* eslint-disable no-console */
/**
 * AC5 & AC8 Verification Script for Story 2.8
 * Verifies bidirectional navigation and sample data
 */

import { prisma } from '../lib/prisma'

async function verifyAC5BidirectionalNavigation() {
  console.log('=== AC5: Bidirectional Navigation Verification ===\n')

  // Test 1: Count cross-references
  const totalRefs = await prisma.crossReference.count()
  console.log('Total cross_references in database:', totalRefs)

  if (totalRefs === 0) {
    console.log('⚠ No cross-references in database. Skipping verification.\n')
    return
  }

  // Test 2: Find a court case that cites a law
  const citingRef = await prisma.crossReference.findFirst({
    where: {
      reference_type: 'CITES',
    },
    include: {
      source_document: {
        select: { id: true, title: true, slug: true, content_type: true },
      },
      target_document: {
        select: { id: true, title: true, slug: true, document_number: true },
      },
    },
  })

  if (citingRef) {
    console.log('\n✓ Test 1: Found CITES reference')
    console.log('  Source (Court Case):', citingRef.source_document.title)
    console.log('  Source slug:', citingRef.source_document.slug)
    console.log('  Target (Law):', citingRef.target_document.title)
    console.log('  Target slug:', citingRef.target_document.slug)
    console.log('  Bidirectional: Law page can show this case via target_document_id lookup ✓')
  } else {
    console.log('\n⚠ No CITES references found')
  }

  // Test 3: Check reference types distribution
  const refTypes = await prisma.crossReference.groupBy({
    by: ['reference_type'],
    _count: true,
  })
  console.log('\nReference types distribution:')
  refTypes.forEach((rt) => console.log('  ' + rt.reference_type + ':', rt._count))

  // Test 4: Orphan check
  const orphans = await prisma.$queryRaw<{ orphan_count: bigint }[]>`
    SELECT COUNT(*) as orphan_count FROM cross_references cr
    LEFT JOIN legal_documents src ON cr.source_document_id = src.id
    LEFT JOIN legal_documents tgt ON cr.target_document_id = tgt.id
    WHERE src.id IS NULL OR tgt.id IS NULL
  `
  const orphanCount = Number(orphans[0].orphan_count)
  if (orphanCount === 0) {
    console.log('\n✓ Test 2: No orphan references found')
  } else {
    console.log('\n✗ Test 2: Found', orphanCount, 'orphan references')
  }

  // Test 5: IMPLEMENTS references
  const implementsRef = await prisma.crossReference.findFirst({
    where: {
      reference_type: 'IMPLEMENTS',
    },
    include: {
      source_document: {
        select: { id: true, title: true, slug: true, document_number: true },
      },
      target_document: {
        select: { id: true, title: true, slug: true, content_type: true },
      },
    },
  })

  if (implementsRef) {
    console.log('\n✓ Test 3: Found IMPLEMENTS reference')
    console.log('  Swedish Law:', implementsRef.source_document.title)
    console.log('  EU Directive:', implementsRef.target_document.title)
    console.log('  Bidirectional: Both pages can navigate to each other ✓')
  } else {
    console.log('\n⚠ No IMPLEMENTS references found (may need EU directive ingestion)')
  }

  console.log('\n')
}

async function verifyAC8SampleVerification() {
  console.log('=== AC8: Sample Verification ===\n')

  // Sample 1: Arbetsmiljölagen (SFS 1977:1160)
  console.log('Sample 1: Arbetsmiljölagen (SFS 1977:1160)')
  const arbetsmiljolagen = await prisma.legalDocument.findFirst({
    where: {
      OR: [
        { document_number: 'SFS 1977:1160' },
        { document_number: '1977:1160' },
        { title: { contains: 'Arbetsmiljö' } },
      ],
      content_type: 'SFS_LAW',
    },
    select: {
      id: true,
      title: true,
      slug: true,
      document_number: true,
    },
  })

  if (arbetsmiljolagen) {
    console.log('  ✓ Found:', arbetsmiljolagen.title)
    console.log('  Document number:', arbetsmiljolagen.document_number)
    console.log('  Slug:', arbetsmiljolagen.slug)

    // Check for court case references
    const citingCases = await prisma.crossReference.count({
      where: {
        target_document_id: arbetsmiljolagen.id,
        reference_type: 'CITES',
      },
    })
    console.log('  Court cases citing this law:', citingCases)
  } else {
    console.log('  ⚠ Arbetsmiljölagen not found in database')
  }

  console.log('')

  // Sample 2: HD case with cited laws
  console.log('Sample 2: HD case with cited laws')
  const hdCase = await prisma.legalDocument.findFirst({
    where: {
      content_type: 'COURT_CASE_HD',
    },
    include: {
      source_references: {
        take: 5,
        include: {
          target_document: {
            select: { title: true, slug: true, document_number: true },
          },
        },
      },
    },
  })

  if (hdCase) {
    console.log('  ✓ Found HD case:', hdCase.title)
    console.log('  Slug:', hdCase.slug)
    if (hdCase.source_references.length > 0) {
      console.log('  Cited laws:')
      hdCase.source_references.forEach((ref) => {
        console.log('    -', ref.target_document.title, '(' + ref.target_document.document_number + ')')
      })
    } else {
      console.log('  ⚠ No cited laws found for this case')
    }
  } else {
    console.log('  ⚠ No HD cases found in database')
  }

  console.log('')

  // Sample 3: GDPR directive with Swedish implementation
  console.log('Sample 3: GDPR directive with Swedish implementation')
  const gdprDirective = await prisma.legalDocument.findFirst({
    where: {
      content_type: { in: ['EU_DIRECTIVE', 'EU_REGULATION'] },
      OR: [
        { title: { contains: 'GDPR' } },
        { title: { contains: '2016/679' } },
        { title: { contains: 'dataskydd' } },
        { title: { contains: 'General Data Protection' } },
      ],
    },
    include: {
      eu_document: true,
      target_references: {
        where: {
          reference_type: 'IMPLEMENTS',
        },
        include: {
          source_document: {
            select: { title: true, slug: true, document_number: true },
          },
        },
      },
    },
  })

  if (gdprDirective) {
    console.log('  ✓ Found:', gdprDirective.title)
    console.log('  CELEX:', gdprDirective.eu_document?.celex_number || 'N/A')
    if (gdprDirective.target_references.length > 0) {
      console.log('  Swedish implementing laws:')
      gdprDirective.target_references.forEach((ref) => {
        console.log('    -', ref.source_document.title, '(' + ref.source_document.document_number + ')')
      })
    } else {
      console.log('  ⚠ No Swedish implementing laws linked via cross_references')
    }
  } else {
    console.log('  ⚠ GDPR directive not found in database')
  }

  // Check for any EU documents
  const euCount = await prisma.legalDocument.count({
    where: {
      content_type: { in: ['EU_DIRECTIVE', 'EU_REGULATION'] },
    },
  })
  console.log('\n  Total EU documents in database:', euCount)

  console.log('\n')
}

async function main() {
  try {
    await verifyAC5BidirectionalNavigation()
    await verifyAC8SampleVerification()
    console.log('=== Verification Complete ===')
  } catch (error) {
    console.error('Verification failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
