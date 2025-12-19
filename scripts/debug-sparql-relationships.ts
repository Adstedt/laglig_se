/* eslint-disable no-console */
/**
 * Debug SPARQL relationship queries
 */

const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql'

async function runQuery(query: string): Promise<unknown> {
  const url = new URL(SPARQL_ENDPOINT)
  url.searchParams.set('query', query)

  console.log('Executing query...')
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
  // Query 1: Test if we can find GDPR at all
  console.log('=== Query 1: Find GDPR work URI ===')
  const q1 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?work ?celex
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  FILTER(?celex = "32016R0679")
}
LIMIT 5
`
  const r1 = (await runQuery(q1)) as {
    results: {
      bindings: Array<{ work: { value: string }; celex: { value: string } }>
    }
  }
  console.log('Results:', r1.results.bindings.length)
  for (const b of r1.results.bindings) {
    console.log(`  Work: ${b.work.value}`)
    console.log(`  CELEX: ${b.celex.value}`)
  }

  // Query 2: What properties does GDPR have?
  if (r1.results.bindings.length > 0) {
    const workUri = r1.results.bindings[0]!.work.value
    console.log(
      '\n=== Query 2: GDPR properties containing "cite" or "based" ==='
    )
    const q2 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT DISTINCT ?pred
WHERE {
  <${workUri}> ?pred ?obj .
  FILTER(
    CONTAINS(LCASE(STR(?pred)), "cite") ||
    CONTAINS(LCASE(STR(?pred)), "based") ||
    CONTAINS(LCASE(STR(?pred)), "amend")
  )
}
`
    const r2 = (await runQuery(q2)) as {
      results: { bindings: Array<{ pred: { value: string } }> }
    }
    console.log('Predicates found:', r2.results.bindings.length)
    for (const b of r2.results.bindings) {
      console.log(`  ${b.pred.value}`)
    }
  }

  // Query 3: Try work_cites_work directly on known document
  console.log(
    '\n=== Query 3: Direct work_cites_work on a court case (known to work) ==='
  )
  const q3 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?celex (COUNT(?citation) AS ?citationCount)
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_cites_work ?citation .
  ?work cdm:work_has_resource-type <http://publications.europa.eu/resource/authority/resource-type/REG> .
}
GROUP BY ?celex
ORDER BY DESC(?citationCount)
LIMIT 3
`
  const r3 = (await runQuery(q3)) as {
    results: {
      bindings: Array<{
        celex: { value: string }
        citationCount: { value: string }
      }>
    }
  }
  console.log('Top regulations with citations:')
  for (const b of r3.results.bindings) {
    console.log(`  ${b.celex.value}: ${b.citationCount.value} citations`)
  }

  // Query 4: Get actual citations for top regulation
  if (r3.results.bindings.length > 0) {
    const topCelex = r3.results.bindings[0]!.celex.value
    console.log(`\n=== Query 4: Citations from ${topCelex} ===`)
    const q4 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?targetCelex
WHERE {
  ?work cdm:resource_legal_id_celex "${topCelex}" .
  ?work cdm:work_cites_work ?target .
  ?target cdm:resource_legal_id_celex ?targetCelex .
}
LIMIT 10
`
    const r4 = (await runQuery(q4)) as {
      results: { bindings: Array<{ targetCelex: { value: string } }> }
    }
    console.log(`Found ${r4.results.bindings.length} citations:`)
    for (const b of r4.results.bindings) {
      console.log(`  ${b.targetCelex.value}`)
    }
  }

  // Query 5: Try the exact query we're using in our function
  console.log('\n=== Query 5: Our function query with VALUES ===')
  const q5 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?celex ?relationType ?targetCelex
WHERE {
  VALUES ?celex { "32016R0679" "32024R2509" }

  ?work cdm:resource_legal_id_celex ?celex .

  {
    ?work cdm:work_cites_work ?target .
    ?target cdm:resource_legal_id_celex ?targetCelex .
    BIND("CITES" AS ?relationType)
  }
}
LIMIT 20
`
  const r5 = (await runQuery(q5)) as {
    results: {
      bindings: Array<{
        celex: { value: string }
        targetCelex: { value: string }
      }>
    }
  }
  console.log(`Found ${r5.results.bindings.length} results:`)
  for (const b of r5.results.bindings) {
    console.log(`  ${b.celex.value} -> ${b.targetCelex.value}`)
  }
}

test().catch(console.error)
