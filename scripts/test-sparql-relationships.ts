/* eslint-disable no-console */
/**
 * Test SPARQL query to verify relationship data is being returned
 */

import {
  fetchRegulationsByYear,
  fetchDirectivesByYear,
} from '../lib/external/eurlex'

async function test() {
  console.log('=== Testing SPARQL Relationship Data ===\n')

  // Fetch a small batch from 2020 to see relationship data
  console.log('Fetching 10 regulations from 2020...')
  const regulations = await fetchRegulationsByYear(2020, 10, 0)

  console.log(`Got ${regulations.length} regulations\n`)

  // Check each for relationship data
  let withLegalBasis = 0
  let withCites = 0

  for (const doc of regulations) {
    if (doc.legalBasisCelex.length > 0) withLegalBasis++
    if (doc.citesCelex.length > 0) withCites++

    console.log(`${doc.celex}:`)
    console.log(`  Title: ${doc.title.substring(0, 60)}...`)
    console.log(`  Authors: ${doc.authors.join(', ') || 'none'}`)
    console.log(`  Directory codes: ${doc.directoryCodes.join(', ') || 'none'}`)
    console.log(
      `  Legal basis: ${doc.legalBasisCelex.slice(0, 3).join(', ') || 'none'}`
    )
    console.log(
      `  Cites: ${doc.citesCelex.slice(0, 3).join(', ') || 'none'} ${doc.citesCelex.length > 3 ? `(+${doc.citesCelex.length - 3} more)` : ''}`
    )
    console.log('')
  }

  console.log('=== Summary ===')
  console.log(`With legal basis: ${withLegalBasis}/${regulations.length}`)
  console.log(`With citations: ${withCites}/${regulations.length}`)

  // Also test directives
  console.log('\n=== Testing Directives ===')
  const directives = await fetchDirectivesByYear(2020, 5, 0)
  console.log(`Got ${directives.length} directives`)

  for (const doc of directives) {
    console.log(`${doc.celex}:`)
    console.log(`  Legal basis: ${doc.legalBasisCelex.join(', ') || 'none'}`)
    console.log(`  Cites: ${doc.citesCelex.slice(0, 5).join(', ') || 'none'}`)
    console.log(
      `  Transposition deadline: ${doc.transpositionDeadline?.toISOString() || 'none'}`
    )
    console.log('')
  }
}

test().catch(console.error)
