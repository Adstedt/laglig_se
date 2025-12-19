/* eslint-disable no-console */
/**
 * Debug SPARQL - find why CELEX filter returns different results
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
  // Query 1: The COUNT query that works
  console.log('=== Query 1: COUNT query (works) ===')
  const q1 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?celex (COUNT(?citation) AS ?citationCount)
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_cites_work ?citation .
  ?work cdm:work_has_resource-type <http://publications.europa.eu/resource/authority/resource-type/REG> .
}
GROUP BY ?celex
HAVING(COUNT(?citation) > 100)
ORDER BY DESC(?citationCount)
LIMIT 3
`
  const r1 = (await runQuery(q1)) as {
    results: {
      bindings: Array<{
        celex: { value: string }
        citationCount: { value: string }
      }>
    }
  }
  console.log(`Found ${r1.results.bindings.length} results:`)
  for (const b of r1.results.bindings) {
    console.log(`  ${b.celex.value}: ${b.citationCount.value}`)
  }

  // Now let's try to get citations for the first CELEX using different methods
  const testCelex = r1.results.bindings[0]?.celex.value
  if (!testCelex) {
    console.log('No CELEX found!')
    return
  }

  console.log(`\nUsing CELEX: ${testCelex}`)

  // Query 2: Using FILTER with =
  console.log('\n=== Query 2: FILTER(?celex = "...") ===')
  const q2 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?work ?citation
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_cites_work ?citation .
  FILTER(?celex = "${testCelex}")
}
LIMIT 5
`
  const r2 = (await runQuery(q2)) as { results: { bindings: unknown[] } }
  console.log(`Results: ${r2.results.bindings.length}`)

  // Query 3: Using STR() comparison
  console.log('\n=== Query 3: FILTER(STR(?celex) = "...") ===')
  const q3 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?work ?citation
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_cites_work ?citation .
  FILTER(STR(?celex) = "${testCelex}")
}
LIMIT 5
`
  const r3 = (await runQuery(q3)) as { results: { bindings: unknown[] } }
  console.log(`Results: ${r3.results.bindings.length}`)

  // Query 4: Without citation filter - just find the work
  console.log('\n=== Query 4: Just find work by CELEX ===')
  const q4 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?work
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  FILTER(STR(?celex) = "${testCelex}")
}
LIMIT 5
`
  const r4 = (await runQuery(q4)) as {
    results: { bindings: Array<{ work: { value: string } }> }
  }
  console.log(`Results: ${r4.results.bindings.length}`)
  for (const b of r4.results.bindings) {
    console.log(`  ${b.work.value}`)
  }

  // Query 5: Find work AND check if it has citations
  if (r4.results.bindings.length > 0) {
    const workUri = r4.results.bindings[0]!.work.value
    console.log(`\n=== Query 5: Citations for work URI directly ===`)
    console.log(`Work: ${workUri}`)
    const q5 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?citation
WHERE {
  <${workUri}> cdm:work_cites_work ?citation .
}
LIMIT 10
`
    const r5 = (await runQuery(q5)) as {
      results: { bindings: Array<{ citation: { value: string } }> }
    }
    console.log(`Results: ${r5.results.bindings.length}`)
    for (const b of r5.results.bindings.slice(0, 5)) {
      console.log(`  ${b.citation.value}`)
    }
  }

  // Query 6: What type is the CELEX value?
  console.log('\n=== Query 6: CELEX datatype ===')
  const q6 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?celex (DATATYPE(?celex) AS ?dtype) (LANG(?celex) AS ?lang)
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_has_resource-type <http://publications.europa.eu/resource/authority/resource-type/REG> .
}
LIMIT 5
`
  const r6 = (await runQuery(q6)) as {
    results: {
      bindings: Array<{
        celex: { value: string; datatype?: string }
        dtype?: { value: string }
        lang?: { value: string }
      }>
    }
  }
  console.log('CELEX values and types:')
  for (const b of r6.results.bindings) {
    console.log(
      `  "${b.celex.value}" - dtype: ${b.dtype?.value || 'none'}, lang: ${b.lang?.value || 'none'}`
    )
  }
}

test().catch(console.error)
