/* eslint-disable no-console */
/**
 * Debug SPARQL relationship queries - Part 2
 */

const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql'

async function runQuery(query: string): Promise<unknown> {
  const url = new URL(SPARQL_ENDPOINT)
  url.searchParams.set('query', query)

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'Laglig.se/1.0',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${response.statusText}\n${text}`)
  }

  return response.json()
}

async function test() {
  // Query 1: Get raw citation URIs (not requiring target CELEX)
  console.log('=== Query 1: Raw citations from top regulation ===')
  const q1 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?citation
WHERE {
  ?work cdm:resource_legal_id_celex "32024R2509" .
  ?work cdm:work_cites_work ?citation .
}
LIMIT 10
`
  const r1 = (await runQuery(q1)) as {
    results: { bindings: Array<{ citation: { value: string } }> }
  }
  console.log(`Found ${r1.results.bindings.length} citation URIs:`)
  for (const b of r1.results.bindings) {
    console.log(`  ${b.citation.value}`)
  }

  // Query 2: Look at what properties a citation has
  if (r1.results.bindings.length > 0) {
    const citationUri = r1.results.bindings[0]!.citation.value
    console.log(`\n=== Query 2: Properties of first citation ===`)
    console.log(`URI: ${citationUri}`)
    const q2 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?pred ?obj
WHERE {
  <${citationUri}> ?pred ?obj .
}
LIMIT 30
`
    const r2 = (await runQuery(q2)) as {
      results: {
        bindings: Array<{ pred: { value: string }; obj: { value: string } }>
      }
    }
    console.log(`Found ${r2.results.bindings.length} properties:`)
    for (const b of r2.results.bindings) {
      const predName =
        b.pred.value.split('#')[1] || b.pred.value.split('/').pop()
      const objShort =
        b.obj.value.length > 80
          ? b.obj.value.substring(0, 80) + '...'
          : b.obj.value
      console.log(`  ${predName}: ${objShort}`)
    }
  }

  // Query 3: Try to extract CELEX from citation URI
  console.log('\n=== Query 3: Extract CELEX using STRAFTER ===')
  const q3 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?citation (STRAFTER(STR(?citation), "celex/") AS ?extractedCelex)
WHERE {
  ?work cdm:resource_legal_id_celex "32024R2509" .
  ?work cdm:work_cites_work ?citation .
  FILTER(CONTAINS(STR(?citation), "celex/"))
}
LIMIT 10
`
  const r3 = (await runQuery(q3)) as {
    results: {
      bindings: Array<{
        citation: { value: string }
        extractedCelex: { value: string }
      }>
    }
  }
  console.log(`Found ${r3.results.bindings.length} results:`)
  for (const b of r3.results.bindings) {
    console.log(`  ${b.extractedCelex.value}`)
  }

  // Query 4: Alternative - use BIND to extract CELEX from URI
  console.log('\n=== Query 4: Using regex to extract CELEX ===')
  const q4 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?citationUri
       (REPLACE(STR(?citationUri), ".*celex/([^/]+).*", "$1") AS ?celex)
WHERE {
  ?work cdm:resource_legal_id_celex "32024R2509" .
  ?work cdm:work_cites_work ?citationUri .
  FILTER(CONTAINS(STR(?citationUri), "celex/"))
}
LIMIT 10
`
  const r4 = (await runQuery(q4)) as {
    results: {
      bindings: Array<{
        citationUri: { value: string }
        celex: { value: string }
      }>
    }
  }
  console.log(`Found ${r4.results.bindings.length} results:`)
  for (const b of r4.results.bindings) {
    console.log(`  ${b.celex.value}`)
  }

  // Query 5: Just get ALL citations for 32024R2509 with raw URIs
  console.log('\n=== Query 5: All citation URIs (sample patterns) ===')
  const q5 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?citation
WHERE {
  ?work cdm:resource_legal_id_celex "32024R2509" .
  ?work cdm:work_cites_work ?citation .
}
LIMIT 50
`
  const r5 = (await runQuery(q5)) as {
    results: { bindings: Array<{ citation: { value: string } }> }
  }
  console.log(`Total: ${r5.results.bindings.length}`)

  // Categorize URIs
  const celexUris = r5.results.bindings.filter((b) =>
    b.citation.value.includes('/celex/')
  )
  const cellarUris = r5.results.bindings.filter((b) =>
    b.citation.value.includes('/cellar/')
  )
  const otherUris = r5.results.bindings.filter(
    (b) =>
      !b.citation.value.includes('/celex/') &&
      !b.citation.value.includes('/cellar/')
  )

  console.log(`\nCELEX URIs: ${celexUris.length}`)
  celexUris.slice(0, 3).forEach((b) => console.log(`  ${b.citation.value}`))

  console.log(`\nCellar URIs: ${cellarUris.length}`)
  cellarUris.slice(0, 3).forEach((b) => console.log(`  ${b.citation.value}`))

  console.log(`\nOther URIs: ${otherUris.length}`)
  otherUris.slice(0, 3).forEach((b) => console.log(`  ${b.citation.value}`))
}

test().catch(console.error)
