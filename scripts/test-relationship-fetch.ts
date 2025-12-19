/* eslint-disable no-console */
/**
 * Test the new relationship fetching function
 */

import { fetchDocumentRelationships } from '../lib/external/eurlex'

async function test() {
  console.log('=== Testing fetchDocumentRelationships ===\n')

  // Test with a few known documents
  const testCelex = [
    '32016R0679', // GDPR
    '32020L1057', // The directive user mentioned
    '32018R1046', // Known to have many citations
    '32024R2509', // Has 125 citations
  ]

  console.log('Fetching relationships for:', testCelex.join(', '))
  console.log('')

  const startTime = Date.now()
  const relationships = await fetchDocumentRelationships(testCelex)
  const duration = Date.now() - startTime

  console.log(`Fetched in ${duration}ms\n`)

  for (const [celex, rel] of relationships) {
    console.log(`=== ${celex} ===`)
    console.log(`  Cites: ${rel.citesCelex.length} documents`)
    if (rel.citesCelex.length > 0) {
      console.log(`    First 5: ${rel.citesCelex.slice(0, 5).join(', ')}`)
    }
    console.log(`  Legal basis: ${rel.legalBasisCelex.length} documents`)
    if (rel.legalBasisCelex.length > 0) {
      console.log(`    ${rel.legalBasisCelex.join(', ')}`)
    }
    console.log(`  Amends: ${rel.amendsCelex.length} documents`)
    if (rel.amendsCelex.length > 0) {
      console.log(`    ${rel.amendsCelex.join(', ')}`)
    }
    console.log(`  Amended by: ${rel.amendedByCelex.length} documents`)
    if (rel.amendedByCelex.length > 0) {
      console.log(`    First 5: ${rel.amendedByCelex.slice(0, 5).join(', ')}`)
    }
    console.log(`  Corrected by: ${rel.correctedByCelex.length} documents`)
    if (rel.correctedByCelex.length > 0) {
      console.log(`    ${rel.correctedByCelex.join(', ')}`)
    }
    console.log(`  Cited by: ${rel.citedByCelex.length} documents`)
    if (rel.citedByCelex.length > 0) {
      console.log(`    First 5: ${rel.citedByCelex.slice(0, 5).join(', ')}`)
    }
    console.log('')
  }

  // Summary
  let totalCites = 0
  let totalLegalBasis = 0
  let totalAmends = 0
  let totalAmendedBy = 0
  let totalCorrectedBy = 0
  let totalCitedBy = 0

  for (const rel of relationships.values()) {
    totalCites += rel.citesCelex.length
    totalLegalBasis += rel.legalBasisCelex.length
    totalAmends += rel.amendsCelex.length
    totalAmendedBy += rel.amendedByCelex.length
    totalCorrectedBy += rel.correctedByCelex.length
    totalCitedBy += rel.citedByCelex.length
  }

  console.log('=== Summary ===')
  console.log(`Total citations: ${totalCites}`)
  console.log(`Total legal basis: ${totalLegalBasis}`)
  console.log(`Total amends: ${totalAmends}`)
  console.log(`Total amended by: ${totalAmendedBy}`)
  console.log(`Total corrected by: ${totalCorrectedBy}`)
  console.log(`Total cited by: ${totalCitedBy}`)
}

test().catch(console.error)
