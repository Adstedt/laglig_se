#!/usr/bin/env tsx
/**
 * Verify SFS Law Ingestion Results
 */

import { prisma } from '../lib/prisma'

async function verifyIngestion() {
  console.log('='.repeat(80))
  console.log('SFS Law Ingestion Verification')
  console.log('='.repeat(80))
  console.log('')

  // Count total SFS laws
  const sfsCount = await prisma.legalDocument.count({
    where: {
      content_type: 'SFS_LAW',
    },
  })

  console.log(`📊 Total SFS laws in database: ${sfsCount}`)
  console.log(`📊 Expected from Riksdagen: 11,365`)
  console.log(`📊 Difference: ${11365 - sfsCount}`)
  console.log('')

  // Count amendments
  const amendmentCount = await prisma.amendment.count()
  console.log(`📊 Total amendments: ${amendmentCount}`)
  console.log('')

  // Sample some laws to verify data quality
  const sampleLaws = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
    },
    select: {
      document_number: true,
      title: true,
      publication_date: true,
    },
    orderBy: {
      publication_date: 'desc',
    },
    take: 10,
  })

  console.log('📄 Sample of most recent laws:')
  sampleLaws.forEach((law) => {
    console.log(`  ${law.document_number} - ${law.title.substring(0, 60)}...`)
  })
  console.log('')

  // Check for any laws without full text (indicating failures)
  const lawsWithoutText = await prisma.legalDocument.count({
    where: {
      content_type: 'SFS_LAW',
      full_text: null,
    },
  })

  console.log(`⚠️  Laws without full text: ${lawsWithoutText}`)

  await prisma.$disconnect()
}

verifyIngestion().catch(console.error)
