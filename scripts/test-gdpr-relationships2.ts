/* eslint-disable no-console */
/**
 * Test SPARQL query to find GDPR and its relationships
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
  console.log('=== Finding GDPR in database ===\n')

  // First, let's find how GDPR is stored
  const query1 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?celex ?work ?title
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  FILTER(CONTAINS(?celex, "2016") && CONTAINS(?celex, "679"))

  OPTIONAL {
    ?expr cdm:expression_belongs_to_work ?work .
    ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
    ?expr cdm:expression_title ?title .
  }
}
LIMIT 10
`

  console.log('Query 1: Finding documents with 2016 and 679 in CELEX')
  const result1 = (await runQuery(query1)) as {
    results: {
      bindings: Array<{
        celex: { value: string }
        work: { value: string }
        title?: { value: string }
      }>
    }
  }
  console.log(`Found ${result1.results.bindings.length} documents`)

  for (const binding of result1.results.bindings) {
    console.log(`\nCELEX: ${binding.celex.value}`)
    console.log(`Work URI: ${binding.work.value}`)
    console.log(`Title: ${binding.title?.value?.substring(0, 80) || 'N/A'}...`)
  }

  // If we found GDPR, let's get its relationships using the work URI
  if (result1.results.bindings.length > 0) {
    const gdprWork = result1.results.bindings[0]!.work.value
    console.log(`\n\n=== Getting relationships for work: ${gdprWork} ===`)

    const query2 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?predicate ?objectCelex
WHERE {
  <${gdprWork}> ?predicate ?object .

  # Get CELEX of related documents
  OPTIONAL { ?object cdm:resource_legal_id_celex ?objectCelex }

  FILTER(
    CONTAINS(STR(?predicate), "cites") ||
    CONTAINS(STR(?predicate), "based_on") ||
    CONTAINS(STR(?predicate), "amend") ||
    CONTAINS(STR(?predicate), "adopt")
  )
}
LIMIT 50
`

    const result2 = (await runQuery(query2)) as {
      results: {
        bindings: Array<{
          predicate: { value: string }
          objectCelex?: { value: string }
        }>
      }
    }
    console.log(
      `Found ${result2.results.bindings.length} relationship bindings`
    )

    for (const binding of result2.results.bindings.slice(0, 20)) {
      const pred =
        binding.predicate.value.split('#')[1] ||
        binding.predicate.value.split('/').pop()
      console.log(`  ${pred} -> ${binding.objectCelex?.value || 'N/A'}`)
    }
  }

  // Query 3: Check what documents cite ANY regulation
  console.log('\n\n=== Sample regulation with citations ===')
  const query3 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?celex (COUNT(?citation) AS ?citationCount)
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_cites_work ?citation .

  ?work cdm:work_has_resource-type <http://publications.europa.eu/resource/authority/resource-type/REG> .
}
GROUP BY ?celex
ORDER BY DESC(?citationCount)
LIMIT 5
`

  const result3 = (await runQuery(query3)) as {
    results: {
      bindings: Array<{
        celex: { value: string }
        citationCount: { value: string }
      }>
    }
  }
  console.log('Top regulations by citation count:')
  for (const binding of result3.results.bindings) {
    console.log(
      `  ${binding.celex.value}: ${binding.citationCount.value} citations`
    )
  }
}

test().catch(console.error)
