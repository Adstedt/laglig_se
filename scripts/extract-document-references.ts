import fs from 'fs'
import path from 'path'

interface CSVRow {
  Laglista: string
  'Section Number': string
  'Section Name': string
  Index: string
  'SFS Number': string
  'Amendment SFS': string
  'Document Name': string
}

interface DocumentReference {
  originalValue: string
  cleanValue: string
  templates: Set<string>
}

const TARGET_TEMPLATES = [
  'Arbetsmiljö',
  'Miljö',
  'Arbetsmiljö för tjänsteföretag',
]

function parseCSV(content: string): CSVRow[] {
  const lines = content.split(/\r?\n/)
  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^"(.*)"$/, '$1'))
  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Simple CSV parsing (assumes no commas within quoted fields in data we care about)
    const values = line
      .split(',')
      .map((v) => v.trim().replace(/^"(.*)"$/, '$1'))
    const row: any = {}

    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })

    rows.push(row as CSVRow)
  }

  return rows
}

async function main() {
  const csvPath = path.join(
    process.cwd(),
    'data/notisum-amnesfokus/laglistor-all-combined.csv'
  )
  const csvContent = fs.readFileSync(csvPath, 'utf-8')

  console.log('Parsing CSV...')
  const rows = parseCSV(csvContent)

  console.log(`Total rows: ${rows.length}`)

  // Filter to target templates
  const filteredRows = rows.filter((row) =>
    TARGET_TEMPLATES.includes(row.Laglista)
  )
  console.log(`Rows in target templates: ${filteredRows.length}`)

  // Track documents by category
  const sfsRefs = new Map<string, DocumentReference>()
  const afsRefs = new Map<string, DocumentReference>()
  const euEgRefs = new Map<string, DocumentReference>()
  const otherAgencyRefs = new Map<string, DocumentReference>()
  const otherRefs = new Map<string, DocumentReference>()

  // Agency patterns
  const agencyPrefixes = [
    'MSBFS',
    'NFS',
    'ELSÄK-FS',
    'KIFS',
    'BFS',
    'SRVFS',
    'SSMFS',
    'STAFS',
    'SCB-FS',
    'SKVFS',
    'FFFS',
    'LVFS',
    'HSLF-FS',
    'DFS',
    'FFS',
    'TSFS',
    'KOVFS',
    'SJVFS',
  ]

  for (const row of filteredRows) {
    const sfsNumber = row['SFS Number']?.trim()
    if (!sfsNumber) continue

    const template = row.Laglista

    // Categorize and extract
    if (sfsNumber.startsWith('SFS ')) {
      // Extract clean SFS number (e.g., "SFS 1977:1160" -> "1977:1160")
      const match = sfsNumber.match(/SFS\s+(\d{4}:\d+)/)
      if (match) {
        const cleanValue = match[1]
        if (!sfsRefs.has(cleanValue)) {
          sfsRefs.set(cleanValue, {
            originalValue: sfsNumber,
            cleanValue,
            templates: new Set([template]),
          })
        } else {
          sfsRefs.get(cleanValue)!.templates.add(template)
        }
      }
    } else if (sfsNumber.includes('AFS')) {
      // Extract AFS number (e.g., "AFS 2023:1 (ersätter AFS 2001:1)" -> "AFS 2023:1")
      const match = sfsNumber.match(/AFS\s+\d{4}:\d+/)
      if (match) {
        const cleanValue = match[0] // "AFS 2023:1"
        if (!afsRefs.has(cleanValue)) {
          afsRefs.set(cleanValue, {
            originalValue: sfsNumber,
            cleanValue,
            templates: new Set([template]),
          })
        } else {
          afsRefs.get(cleanValue)!.templates.add(template)
        }
      }
    } else if (sfsNumber.startsWith('(EU)') || sfsNumber.startsWith('(EG)')) {
      // Extract EU/EG regulation number
      const cleanValue = sfsNumber
      if (!euEgRefs.has(cleanValue)) {
        euEgRefs.set(cleanValue, {
          originalValue: sfsNumber,
          cleanValue,
          templates: new Set([template]),
        })
      } else {
        euEgRefs.get(cleanValue)!.templates.add(template)
      }
    } else {
      // Check for other agency prefixes
      const isAgency = agencyPrefixes.some((prefix) =>
        sfsNumber.includes(prefix)
      )

      if (isAgency) {
        // Extract agency number (e.g., "MSBFS 2023:1")
        const agencyMatch = sfsNumber.match(/([A-ZÄÖÅ-]+)\s+\d{4}:\d+/)
        if (agencyMatch) {
          const cleanValue = agencyMatch[0]
          if (!otherAgencyRefs.has(cleanValue)) {
            otherAgencyRefs.set(cleanValue, {
              originalValue: sfsNumber,
              cleanValue,
              templates: new Set([template]),
            })
          } else {
            otherAgencyRefs.get(cleanValue)!.templates.add(template)
          }
        } else {
          // Couldn't extract clean value, use original
          if (!otherAgencyRefs.has(sfsNumber)) {
            otherAgencyRefs.set(sfsNumber, {
              originalValue: sfsNumber,
              cleanValue: sfsNumber,
              templates: new Set([template]),
            })
          } else {
            otherAgencyRefs.get(sfsNumber)!.templates.add(template)
          }
        }
      } else {
        // Other/unrecognized format
        if (!otherRefs.has(sfsNumber)) {
          otherRefs.set(sfsNumber, {
            originalValue: sfsNumber,
            cleanValue: sfsNumber,
            templates: new Set([template]),
          })
        } else {
          otherRefs.get(sfsNumber)!.templates.add(template)
        }
      }
    }
  }

  // Sort and display results
  console.log('\n=== SFS REFERENCES ===')
  console.log(`Total unique SFS documents: ${sfsRefs.size}`)
  const sortedSfs = Array.from(sfsRefs.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  for (const [cleanValue, ref] of sortedSfs) {
    const templates = Array.from(ref.templates).join(', ')
    console.log(`${cleanValue} | Templates: ${templates}`)
  }

  console.log('\n=== AFS REFERENCES ===')
  console.log(`Total unique AFS documents: ${afsRefs.size}`)
  const sortedAfs = Array.from(afsRefs.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  for (const [cleanValue, ref] of sortedAfs) {
    const templates = Array.from(ref.templates).join(', ')
    console.log(
      `${cleanValue} | Original: ${ref.originalValue} | Templates: ${templates}`
    )
  }

  console.log('\n=== EU/EG REFERENCES ===')
  console.log(`Total unique EU/EG documents: ${euEgRefs.size}`)
  const sortedEu = Array.from(euEgRefs.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  for (const [cleanValue, ref] of sortedEu) {
    const templates = Array.from(ref.templates).join(', ')
    console.log(`${cleanValue} | Templates: ${templates}`)
  }

  console.log('\n=== OTHER AGENCY REFERENCES ===')
  console.log(`Total unique agency documents: ${otherAgencyRefs.size}`)
  const sortedAgency = Array.from(otherAgencyRefs.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  for (const [cleanValue, ref] of sortedAgency) {
    const templates = Array.from(ref.templates).join(', ')
    const orig =
      ref.originalValue !== cleanValue
        ? ` | Original: ${ref.originalValue}`
        : ''
    console.log(`${cleanValue}${orig} | Templates: ${templates}`)
  }

  console.log('\n=== OTHER/UNRECOGNIZED REFERENCES ===')
  console.log(`Total: ${otherRefs.size}`)
  const sortedOther = Array.from(otherRefs.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  for (const [cleanValue, ref] of sortedOther) {
    const templates = Array.from(ref.templates).join(', ')
    console.log(`${cleanValue} | Templates: ${templates}`)
  }

  // Summary statistics
  console.log('\n=== SUMMARY ===')
  console.log(`Total filtered rows: ${filteredRows.length}`)
  console.log(`SFS documents: ${sfsRefs.size}`)
  console.log(`AFS documents: ${afsRefs.size}`)
  console.log(`EU/EG documents: ${euEgRefs.size}`)
  console.log(`Other agency documents: ${otherAgencyRefs.size}`)
  console.log(`Other/unrecognized: ${otherRefs.size}`)
  console.log(
    `Total unique documents: ${sfsRefs.size + afsRefs.size + euEgRefs.size + otherAgencyRefs.size + otherRefs.size}`
  )

  // Write JSON output
  const output = {
    sfs: sortedSfs.map(([clean, ref]) => ({
      sfsNumber: clean,
      original: ref.originalValue,
      templates: Array.from(ref.templates),
    })),
    afs: sortedAfs.map(([clean, ref]) => ({
      afsNumber: clean,
      original: ref.originalValue,
      templates: Array.from(ref.templates),
    })),
    euEg: sortedEu.map(([clean, ref]) => ({
      regulation: clean,
      templates: Array.from(ref.templates),
    })),
    otherAgency: sortedAgency.map(([clean, ref]) => ({
      agencyNumber: clean,
      original: ref.originalValue,
      templates: Array.from(ref.templates),
    })),
    other: sortedOther.map(([clean, ref]) => ({
      value: clean,
      templates: Array.from(ref.templates),
    })),
  }

  const outputPath = path.join(
    process.cwd(),
    'data/notisum-amnesfokus/document-references.json'
  )
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`\nOutput written to: ${outputPath}`)
}

main().catch(console.error)
