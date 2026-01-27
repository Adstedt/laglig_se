/* eslint-disable no-console */
/**
 * Fetch ALL Swedish CELEX IDs from EUR-Lex SPARQL API
 *
 * This creates a master list of all EU documents with Swedish content.
 * We'll use this to reconcile against bulk downloads.
 */

import * as fs from 'fs'
import * as path from 'path'

const SPARQL_ENDPOINT = 'https://publications.europa.eu/webapi/rdf/sparql'
const OUTPUT_FILE = path.join(__dirname, '../data/celex_master.json')
const BATCH_SIZE = 2000 // Smaller batches to avoid API 500 errors
const DELAY_BETWEEN_BATCHES = 3000 // 3 seconds between batches

interface CelexRecord {
  celex: string
  title: string
  type: string // R, L, D, etc.
  publicationDate: string | null
}

interface SPARQLResult {
  results: {
    bindings: Array<{
      celex?: { value: string }
      title?: { value: string }
      pubDate?: { value: string }
    }>
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function executeSparqlQuery(
  query: string,
  retries = 3
): Promise<SPARQLResult> {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=application/json`

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Laglig.se/1.0 (https://laglig.se; contact@laglig.se)',
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const text = await response.text()
      try {
        return JSON.parse(text)
      } catch {
        console.error(
          `Failed to parse JSON (attempt ${attempt}):`,
          text.substring(0, 200)
        )
        throw new Error('Invalid JSON response')
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, (error as Error).message)
      if (attempt === retries) throw error
      await sleep(DELAY_BETWEEN_BATCHES * attempt)
    }
  }

  throw new Error('All retries exhausted')
}

// Document types to query separately
const DOCUMENT_TYPES = [
  { code: 'R', name: 'Regulation' },
  { code: 'L', name: 'Directive' },
  { code: 'D', name: 'Decision' },
  { code: 'H', name: 'Recommendation' },
  { code: 'Q', name: 'Opinion' },
  { code: 'A', name: 'International Agreement' },
  { code: 'M', name: 'Other acts' },
  { code: 'G', name: 'Guidelines' },
  { code: 'O', name: 'Other' },
  { code: 'C', name: 'Declaration' },
  { code: 'Y', name: 'Other (Y)' },
  { code: 'E', name: 'Other (E)' },
  { code: 'F', name: 'Other (F)' },
  { code: 'B', name: 'Budget' },
  { code: 'S', name: 'EFTA' },
  { code: 'J', name: 'Other (J)' },
  { code: 'X', name: 'Other documents' },
  { code: 'K', name: 'ECSC' },
]

async function getCountByType(typeCode: string): Promise<number> {
  const query = `
    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    SELECT (COUNT(DISTINCT ?celex) AS ?count) WHERE {
      ?work cdm:resource_legal_id_celex ?celex .
      FILTER(REGEX(?celex, "^3[0-9]{4}${typeCode}"))
      ?expr cdm:expression_belongs_to_work ?work .
      ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
    }
  `

  const result = await executeSparqlQuery(query)
  return parseInt(result.results.bindings[0]?.count?.value || '0')
}

async function fetchBatchByType(
  typeCode: string,
  offset: number,
  limit: number
): Promise<CelexRecord[]> {
  const query = `
    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    SELECT DISTINCT ?celex ?title ?pubDate WHERE {
      ?work cdm:resource_legal_id_celex ?celex .
      FILTER(REGEX(?celex, "^3[0-9]{4}${typeCode}"))
      ?expr cdm:expression_belongs_to_work ?work .
      ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
      ?expr cdm:expression_title ?title .
      OPTIONAL { ?work cdm:work_date_document ?pubDate }
    }
    ORDER BY ?celex
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const result = await executeSparqlQuery(query)

  return result.results.bindings.map((binding) => {
    const celex = binding.celex?.value || ''

    return {
      celex,
      title: binding.title?.value || '',
      type: typeCode,
      publicationDate: binding.pubDate?.value || null,
    }
  })
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Fetching ALL Swedish CELEX IDs from EUR-Lex SPARQL API')
  console.log('  (Querying by document type to avoid API limits)')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')

  // Ensure data directory exists
  const dataDir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const allRecords: CelexRecord[] = []
  const typeCounts: Record<string, number> = {}

  // Process each document type separately
  for (const docType of DOCUMENT_TYPES) {
    console.log(`\n📋 Processing ${docType.code} (${docType.name})...`)

    // Get count for this type
    let typeCount: number
    try {
      typeCount = await getCountByType(docType.code)
      console.log(`   Found ${typeCount.toLocaleString()} documents`)
    } catch (error) {
      console.log(`   ✗ Failed to get count: ${(error as Error).message}`)
      continue
    }

    if (typeCount === 0) {
      continue
    }

    typeCounts[docType.code] = 0
    let offset = 0

    while (offset < typeCount) {
      const batchNum = Math.floor(offset / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(typeCount / BATCH_SIZE)

      process.stdout.write(`   Batch ${batchNum}/${totalBatches}...`)

      try {
        const batch = await fetchBatchByType(docType.code, offset, BATCH_SIZE)
        allRecords.push(...batch)
        typeCounts[docType.code] += batch.length

        console.log(` ✓ ${batch.length} records`)

        if (batch.length < BATCH_SIZE) {
          break
        }

        offset += BATCH_SIZE
        await sleep(DELAY_BETWEEN_BATCHES)
      } catch (error) {
        console.log(
          ` ✗ FAILED at offset ${offset}: ${(error as Error).message}`
        )
        // Continue to next type instead of stopping
        break
      }
    }

    console.log(
      `   Total for ${docType.code}: ${typeCounts[docType.code]?.toLocaleString() || 0}`
    )
  }

  // Deduplicate by CELEX
  const uniqueRecords = Array.from(
    new Map(allRecords.map((r) => [r.celex, r])).values()
  )

  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  RESULTS')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log(
    `📊 Total unique CELEX IDs: ${uniqueRecords.length.toLocaleString()}`
  )
  console.log('')
  console.log('📋 By document type:')

  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const docType = DOCUMENT_TYPES.find((d) => d.code === type)
      console.log(
        `   ${type} (${docType?.name || 'Unknown'}): ${count.toLocaleString()}`
      )
    })

  // Save to file
  const output = {
    fetchedAt: new Date().toISOString(),
    totalCount: uniqueRecords.length,
    typeCounts,
    records: uniqueRecords,
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2))
  console.log('')
  console.log(`💾 Saved to: ${OUTPUT_FILE}`)
  console.log('')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
