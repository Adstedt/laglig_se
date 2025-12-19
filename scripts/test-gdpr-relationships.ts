/* eslint-disable no-console */
/**
 * Test SPARQL query to get relationships for GDPR (32016R0679)
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
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

async function test() {
  console.log('=== Testing GDPR (32016R0679) Relationships ===\n')

  // Query 1: Get all relationships for GDPR
  const query1 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?predicate ?object
WHERE {
  ?work cdm:resource_legal_id_celex "32016R0679" .
  ?work ?predicate ?object .
  FILTER(
    ?predicate = cdm:work_cites_work ||
    ?predicate = cdm:resource_legal_based_on_resource_legal ||
    ?predicate = cdm:resource_legal_adopts_resource_legal ||
    ?predicate = cdm:work_created_by_agent
  )
}
LIMIT 50
`

  console.log('Query 1: Direct relationships from GDPR')
  const result1 = (await runQuery(query1)) as {
    results: {
      bindings: Array<{
        predicate: { value: string }
        object: { value: string }
      }>
    }
  }
  console.log(`Found ${result1.results.bindings.length} relationships`)

  // Group by predicate
  const byPredicate: Record<string, string[]> = {}
  for (const binding of result1.results.bindings) {
    const pred =
      binding.predicate.value.split('#')[1] || binding.predicate.value
    if (!byPredicate[pred]) byPredicate[pred] = []
    byPredicate[pred].push(binding.object.value)
  }

  for (const [pred, objects] of Object.entries(byPredicate)) {
    console.log(`\n${pred}:`)
    objects.slice(0, 5).forEach((o) => console.log(`  - ${o}`))
    if (objects.length > 5) console.log(`  ... and ${objects.length - 5} more`)
  }

  // Query 2: What documents cite GDPR?
  console.log('\n\n=== Documents that CITE GDPR ===')
  const query2 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?citingCelex ?citingTitle
WHERE {
  ?gdpr cdm:resource_legal_id_celex "32016R0679" .
  ?citingWork cdm:work_cites_work ?gdpr .
  ?citingWork cdm:resource_legal_id_celex ?citingCelex .

  OPTIONAL {
    ?expr cdm:expression_belongs_to_work ?citingWork .
    ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
    ?expr cdm:expression_title ?citingTitle .
  }
}
LIMIT 10
`

  const result2 = (await runQuery(query2)) as {
    results: {
      bindings: Array<{
        citingCelex: { value: string }
        citingTitle?: { value: string }
      }>
    }
  }
  console.log(`Found ${result2.results.bindings.length} documents citing GDPR:`)
  for (const binding of result2.results.bindings.slice(0, 5)) {
    console.log(
      `  - ${binding.citingCelex.value}: ${binding.citingTitle?.value?.substring(0, 60) || '(no Swedish title)'}...`
    )
  }

  // Query 3: What documents is GDPR BASED ON?
  console.log('\n\n=== GDPR Legal Basis ===')
  const query3 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?basisCelex
WHERE {
  ?gdpr cdm:resource_legal_id_celex "32016R0679" .
  ?gdpr cdm:resource_legal_based_on_resource_legal ?basis .
  ?basis cdm:resource_legal_id_celex ?basisCelex .
}
LIMIT 10
`

  const result3 = (await runQuery(query3)) as {
    results: { bindings: Array<{ basisCelex: { value: string } }> }
  }
  console.log(`Found ${result3.results.bindings.length} legal basis documents:`)
  for (const binding of result3.results.bindings) {
    console.log(`  - ${binding.basisCelex.value}`)
  }

  // Query 4: Check what predicates exist
  console.log('\n\n=== All predicates for GDPR ===')
  const query4 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT DISTINCT ?predicate
WHERE {
  ?work cdm:resource_legal_id_celex "32016R0679" .
  ?work ?predicate ?object .
}
ORDER BY ?predicate
`

  const result4 = (await runQuery(query4)) as {
    results: { bindings: Array<{ predicate: { value: string } }> }
  }
  console.log(`Found ${result4.results.bindings.length} predicates:`)
  for (const binding of result4.results.bindings) {
    const pred =
      binding.predicate.value.split('#')[1] ||
      binding.predicate.value.split('/').pop()
    console.log(`  - ${pred}`)
  }
}

test().catch(console.error)
