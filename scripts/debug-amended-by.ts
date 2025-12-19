/* eslint-disable no-console */
/**
 * Debug the AMENDED_BY relationship for 32020L1057
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
  const targetCelex = '32020L1057'

  console.log(`=== Finding documents that AMEND ${targetCelex} ===\n`)

  // Query 1: Find work URI
  const q1 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?work
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  FILTER(STR(?celex) = "${targetCelex}")
}
LIMIT 1
`
  const r1 = (await runQuery(q1)) as {
    results: { bindings: Array<{ work: { value: string } }> }
  }
  console.log('Work URI:', r1.results.bindings[0]?.work?.value || 'NOT FOUND')

  if (r1.results.bindings.length === 0) {
    console.log('Cannot find work!')
    return
  }

  const workUri = r1.results.bindings[0]!.work.value

  // Query 2: Direct amends relationship
  console.log('\n=== Query 2: Documents that amend this (direct query) ===')
  const q2 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?amendingCelex ?amendingWork
WHERE {
  ?amendingWork cdm:resource_legal_amends_resource_legal <${workUri}> .
  ?amendingWork cdm:resource_legal_id_celex ?amendingCelex .
}
`
  const r2 = (await runQuery(q2)) as {
    results: { bindings: Array<{ amendingCelex: { value: string } }> }
  }
  console.log(`Found: ${r2.results.bindings.length}`)
  for (const b of r2.results.bindings) {
    console.log(`  ${b.amendingCelex.value}`)
  }

  // Query 3: Try different predicate names
  console.log(
    '\n=== Query 3: All predicates mentioning "amend" on this work ==='
  )
  const q3 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT DISTINCT ?pred
WHERE {
  {
    <${workUri}> ?pred ?obj .
    FILTER(CONTAINS(LCASE(STR(?pred)), "amend"))
  } UNION {
    ?subj ?pred <${workUri}> .
    FILTER(CONTAINS(LCASE(STR(?pred)), "amend"))
  }
}
`
  const r3 = (await runQuery(q3)) as {
    results: { bindings: Array<{ pred: { value: string } }> }
  }
  console.log(`Found predicates: ${r3.results.bindings.length}`)
  for (const b of r3.results.bindings) {
    console.log(`  ${b.pred.value}`)
  }

  // Query 4: Try is_amended_by (reverse relationship)
  console.log('\n=== Query 4: Try resource_legal_amended_by_resource_legal ===')
  const q4 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?amendingCelex
WHERE {
  <${workUri}> cdm:resource_legal_amended_by_resource_legal ?amendingWork .
  ?amendingWork cdm:resource_legal_id_celex ?amendingCelex .
}
`
  const r4 = (await runQuery(q4)) as {
    results: { bindings: Array<{ amendingCelex: { value: string } }> }
  }
  console.log(`Found: ${r4.results.bindings.length}`)
  for (const b of r4.results.bindings) {
    console.log(`  ${b.amendingCelex.value}`)
  }

  // Query 5: Check all predicates pointing TO this work
  console.log('\n=== Query 5: All predicates where this work is the object ===')
  const q5 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT DISTINCT ?pred (COUNT(?subj) AS ?count)
WHERE {
  ?subj ?pred <${workUri}> .
}
GROUP BY ?pred
ORDER BY DESC(?count)
LIMIT 20
`
  const r5 = (await runQuery(q5)) as {
    results: {
      bindings: Array<{ pred: { value: string }; count: { value: string } }>
    }
  }
  console.log('Predicates pointing to this work:')
  for (const b of r5.results.bindings) {
    const predName = b.pred.value.split('#')[1] || b.pred.value.split('/').pop()
    console.log(`  ${predName}: ${b.count.value}`)
  }

  // Query 6: Try looking for work_cites_work pointing to this work (cited by)
  console.log('\n=== Query 6: Documents that CITE this work ===')
  const q6 = `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>

SELECT ?citingCelex
WHERE {
  ?citingWork cdm:work_cites_work <${workUri}> .
  ?citingWork cdm:resource_legal_id_celex ?citingCelex .
}
LIMIT 10
`
  const r6 = (await runQuery(q6)) as {
    results: { bindings: Array<{ citingCelex: { value: string } }> }
  }
  console.log(`Found: ${r6.results.bindings.length}`)
  for (const b of r6.results.bindings) {
    console.log(`  ${b.citingCelex.value}`)
  }
}

test().catch(console.error)
