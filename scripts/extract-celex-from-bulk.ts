/* eslint-disable no-console */
/**
 * Extract CELEX IDs and metadata from bulk RDF download
 *
 * This is more reliable than the SPARQL API which crashes at 10K results.
 * The bulk metadata download IS the authoritative source.
 */

import * as fs from 'fs'
import * as path from 'path'

const METADATA_DIR = 'c:/Users/audri/Desktop/EUR LEX METADATA'
const FMX_DIR = 'c:/Users/audri/Desktop/EUR LEX FMX'
const HTML_DIR = 'c:/Users/audri/Desktop/EUR LEX'
const OUTPUT_FILE = path.join(__dirname, '../data/celex_master_from_bulk.json')

interface DocumentRecord {
  uuid: string
  celex: string
  type: string
  title: string | null
  publicationDate: string | null
  hasFmx: boolean
  hasHtml: boolean
}

function extractFromRdf(
  rdfPath: string,
  uuid: string
): Partial<DocumentRecord> | null {
  // Read file in chunks to avoid memory issues - only read first 50KB
  // CELEX and title are usually in the first part of the RDF
  const fd = fs.openSync(rdfPath, 'r')
  const buffer = Buffer.alloc(50000)
  const bytesRead = fs.readSync(fd, buffer, 0, 50000, 0)
  fs.closeSync(fd)

  const rdfContent = buffer.toString('utf-8', 0, bytesRead)

  // Extract CELEX number - pattern like resource/celex/32022D2391
  const celexMatch = rdfContent.match(/resource\/celex\/(3\d{4}[A-Z]\d+)/)
  if (!celexMatch) {
    return null
  }

  const celex = celexMatch[1]
  const typeMatch = celex.match(/^3\d{4}([A-Z])/)
  const type = typeMatch ? typeMatch[1] : 'UNKNOWN'

  // Extract Swedish title - expression_title xml:lang="sv"
  const titleMatch = rdfContent.match(
    /expression_title[^>]*xml:lang="sv">([^<]+)</
  )
  const title = titleMatch ? titleMatch[1] : null

  // Extract publication date - work_date_document
  const dateMatch = rdfContent.match(
    /work_date_document[^>]*>(\d{4}-\d{2}-\d{2})</
  )
  const publicationDate = dateMatch ? dateMatch[1] : null

  return {
    uuid,
    celex,
    type,
    title,
    publicationDate,
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Extracting CELEX IDs from Bulk Metadata Download')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')

  // Ensure data directory exists
  const dataDir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  // Get list of folders
  console.log('📂 Scanning metadata directory...')
  const metadataFolders = fs.readdirSync(METADATA_DIR).filter((f) => {
    const fullPath = path.join(METADATA_DIR, f)
    return fs.statSync(fullPath).isDirectory()
  })
  console.log(
    `   Found ${metadataFolders.length.toLocaleString()} metadata folders`
  )

  // Check FMX and HTML directories
  console.log('')
  console.log('📂 Scanning FMX directory...')
  const fmxFolders = new Set(
    fs.readdirSync(FMX_DIR).filter((f) => {
      const fullPath = path.join(FMX_DIR, f)
      return fs.statSync(fullPath).isDirectory()
    })
  )
  console.log(`   Found ${fmxFolders.size.toLocaleString()} FMX folders`)

  console.log('')
  console.log('📂 Scanning HTML directory...')
  const htmlFolders = new Set(
    fs.readdirSync(HTML_DIR).filter((f) => {
      const fullPath = path.join(HTML_DIR, f)
      return fs.statSync(fullPath).isDirectory()
    })
  )
  console.log(`   Found ${htmlFolders.size.toLocaleString()} HTML folders`)

  // Process each metadata folder
  console.log('')
  console.log('🔍 Extracting metadata from RDF files...')
  console.log('')

  const records: DocumentRecord[] = []
  const typeCounts: Record<string, number> = {}
  const errors: string[] = []
  let processed = 0

  for (const uuid of metadataFolders) {
    const rdfPath = path.join(METADATA_DIR, uuid, 'tree_non_inferred.rdf')

    try {
      if (!fs.existsSync(rdfPath)) {
        errors.push(`Missing RDF: ${uuid}`)
        continue
      }

      const extracted = extractFromRdf(rdfPath, uuid)

      if (!extracted || !extracted.celex) {
        errors.push(`No CELEX found: ${uuid}`)
        continue
      }

      const record: DocumentRecord = {
        uuid,
        celex: extracted.celex,
        type: extracted.type || 'UNKNOWN',
        title: extracted.title || null,
        publicationDate: extracted.publicationDate || null,
        hasFmx: fmxFolders.has(uuid),
        hasHtml: htmlFolders.has(uuid),
      }

      records.push(record)
      typeCounts[record.type] = (typeCounts[record.type] || 0) + 1
    } catch (error) {
      errors.push(`Error processing ${uuid}: ${(error as Error).message}`)
    }

    processed++
    if (processed % 10000 === 0) {
      console.log(
        `   Processed ${processed.toLocaleString()}/${metadataFolders.length.toLocaleString()}...`
      )
    }
  }

  // Calculate coverage stats
  const withFmx = records.filter((r) => r.hasFmx).length
  const withHtml = records.filter((r) => r.hasHtml).length
  const withBoth = records.filter((r) => r.hasFmx && r.hasHtml).length
  const withEither = records.filter((r) => r.hasFmx || r.hasHtml).length
  const withNeither = records.filter((r) => !r.hasFmx && !r.hasHtml).length
  const withTitle = records.filter((r) => r.title).length

  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  RESULTS')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log(
    `📊 Total documents with CELEX: ${records.length.toLocaleString()}`
  )
  console.log(`   Errors/skipped: ${errors.length.toLocaleString()}`)
  console.log('')
  console.log('📋 By document type:')

  const typeNames: Record<string, string> = {
    R: 'Regulation',
    L: 'Directive',
    D: 'Decision',
    H: 'Recommendation',
    Q: 'Opinion',
    A: 'International Agreement',
    M: 'Other acts',
    G: 'Guidelines',
    O: 'Other',
    C: 'Declaration',
    Y: 'Other (Y)',
    E: 'Other (E)',
    F: 'Other (F)',
    B: 'Budget',
    S: 'EFTA',
    J: 'Other (J)',
    X: 'Other documents',
    K: 'ECSC',
  }

  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(
        `   ${type} (${typeNames[type] || 'Unknown'}): ${count.toLocaleString()}`
      )
    })

  console.log('')
  console.log('📦 Content coverage:')
  console.log(
    `   Has FMX content: ${withFmx.toLocaleString()} (${((withFmx / records.length) * 100).toFixed(1)}%)`
  )
  console.log(
    `   Has HTML content: ${withHtml.toLocaleString()} (${((withHtml / records.length) * 100).toFixed(1)}%)`
  )
  console.log(
    `   Has both: ${withBoth.toLocaleString()} (${((withBoth / records.length) * 100).toFixed(1)}%)`
  )
  console.log(
    `   Has either: ${withEither.toLocaleString()} (${((withEither / records.length) * 100).toFixed(1)}%)`
  )
  console.log(
    `   Has neither (metadata only): ${withNeither.toLocaleString()} (${((withNeither / records.length) * 100).toFixed(1)}%)`
  )
  console.log(
    `   Has Swedish title: ${withTitle.toLocaleString()} (${((withTitle / records.length) * 100).toFixed(1)}%)`
  )

  // Save to file
  const output = {
    extractedAt: new Date().toISOString(),
    source: {
      metadataDir: METADATA_DIR,
      fmxDir: FMX_DIR,
      htmlDir: HTML_DIR,
    },
    stats: {
      totalRecords: records.length,
      errors: errors.length,
      typeCounts,
      coverage: {
        withFmx,
        withHtml,
        withBoth,
        withEither,
        withNeither,
        withTitle,
      },
    },
    records,
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2))
  console.log('')
  console.log(`💾 Saved to: ${OUTPUT_FILE}`)

  // Save errors separately if any
  if (errors.length > 0) {
    const errorFile = OUTPUT_FILE.replace('.json', '_errors.txt')
    fs.writeFileSync(errorFile, errors.join('\n'))
    console.log(`⚠️  Errors saved to: ${errorFile}`)
  }
  console.log('')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
