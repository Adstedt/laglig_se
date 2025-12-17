/* eslint-disable no-console */
/**
 * Final SFS Comparison: Database vs API
 *
 * Uses the API list fetched by year (more complete)
 */

import { prisma } from '../lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

const OUTPUT_DIR = 'data/sfs-comparison'

async function main() {
  console.log('='.repeat(60))
  console.log('Final SFS Comparison: Database vs API')
  console.log('='.repeat(60))
  console.log('')

  const outputDir = path.join(process.cwd(), OUTPUT_DIR)

  // Read API list
  const apiListPath = path.join(outputDir, 'api-sfs-list.txt')
  const apiListRaw = fs.readFileSync(apiListPath, 'utf-8')
  const apiSfsNumbers = new Set(
    apiListRaw
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
  )

  console.log(`API SFS count: ${apiSfsNumbers.size}`)

  // Read API full list for titles
  const apiFullPath = path.join(outputDir, 'api-sfs-full-list.txt')
  const apiFullRaw = fs.readFileSync(apiFullPath, 'utf-8')
  const apiDetails = new Map<
    string,
    { date: string; title: string; dok_id: string }
  >()
  for (const line of apiFullRaw.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    const [sfs, date, dok_id, ...titleParts] = line.split('\t')
    apiDetails.set(sfs, { date, title: titleParts.join('\t'), dok_id })
  }

  // Fetch DB list
  console.log('Fetching SFS from database...')
  const dbDocuments = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_LAW' },
    select: { document_number: true, title: true },
    orderBy: { document_number: 'asc' },
  })

  // Normalize: "SFS 2025:123" -> "2025:123"
  const dbSfsNumbers = new Set(
    dbDocuments.map((doc) => doc.document_number.replace('SFS ', ''))
  )
  const dbDetails = new Map(
    dbDocuments.map((doc) => [
      doc.document_number.replace('SFS ', ''),
      doc.title,
    ])
  )

  console.log(`DB SFS count: ${dbSfsNumbers.size}`)
  console.log('')

  // Compare
  const missingFromDb: string[] = []
  for (const sfs of apiSfsNumbers) {
    if (!dbSfsNumbers.has(sfs)) {
      missingFromDb.push(sfs)
    }
  }
  missingFromDb.sort()

  const extraInDb: string[] = []
  for (const sfs of dbSfsNumbers) {
    if (!apiSfsNumbers.has(sfs)) {
      extraInDb.push(sfs)
    }
  }
  extraInDb.sort()

  const matching = dbSfsNumbers.size - extraInDb.length

  console.log(`Missing from DB: ${missingFromDb.length}`)
  console.log(`Extra in DB: ${extraInDb.length}`)
  console.log(`Matching: ${matching}`)
  console.log('')

  // Write missing from DB with details
  const missingContent = missingFromDb
    .map((sfs) => {
      const details = apiDetails.get(sfs)
      return `${sfs}\t${details?.date || ''}\t${details?.dok_id || ''}\t${details?.title || ''}`
    })
    .join('\n')
  fs.writeFileSync(
    path.join(outputDir, 'missing-from-db.txt'),
    `# SFS numbers in API but NOT in database\n# Total: ${missingFromDb.length}\n# Format: SFS\\tDATE\\tDOK_ID\\tTITLE\n#\n${missingContent}\n`
  )
  console.log(`Written: missing-from-db.txt (${missingFromDb.length} entries)`)

  // Write extra in DB with details
  const extraContent = extraInDb
    .map((sfs) => {
      const title = dbDetails.get(sfs) || ''
      return `${sfs}\t${title}`
    })
    .join('\n')
  fs.writeFileSync(
    path.join(outputDir, 'extra-in-db.txt'),
    `# SFS numbers in DB but NOT in API\n# Total: ${extraInDb.length}\n# Format: SFS\\tTITLE\n#\n${extraContent}\n`
  )
  console.log(`Written: extra-in-db.txt (${extraInDb.length} entries)`)

  // Write DB list
  const dbList = Array.from(dbSfsNumbers).sort()
  fs.writeFileSync(
    path.join(outputDir, 'db-sfs-list.txt'),
    dbList.join('\n') + '\n'
  )
  console.log(`Written: db-sfs-list.txt (${dbList.length} entries)`)

  // Write summary
  fs.writeFileSync(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(
      {
        dbCount: dbSfsNumbers.size,
        apiCount: apiSfsNumbers.size,
        missingFromDb: missingFromDb.length,
        extraInDb: extraInDb.length,
        matchingCount: matching,
        comparedAt: new Date().toISOString(),
      },
      null,
      2
    ) + '\n'
  )
  console.log(`Written: summary.json`)

  console.log('')
  console.log('='.repeat(60))

  // Show sample of missing
  if (missingFromDb.length > 0) {
    console.log(`\nFirst 30 MISSING from DB (in API but not DB):`)
    console.log('-'.repeat(60))
    for (const sfs of missingFromDb.slice(0, 30)) {
      const details = apiDetails.get(sfs)
      console.log(`${sfs.padEnd(15)} ${details?.title?.substring(0, 60) || ''}`)
    }
    if (missingFromDb.length > 30) {
      console.log(`... and ${missingFromDb.length - 30} more`)
    }
  }

  // Show sample of extra
  if (extraInDb.length > 0) {
    console.log(`\nFirst 30 EXTRA in DB (in DB but not API):`)
    console.log('-'.repeat(60))
    for (const sfs of extraInDb.slice(0, 30)) {
      const title = dbDetails.get(sfs) || ''
      console.log(`${sfs.padEnd(15)} ${title.substring(0, 60)}`)
    }
    if (extraInDb.length > 30) {
      console.log(`... and ${extraInDb.length - 30} more`)
    }
  }

  await prisma.$disconnect()
}

main().catch(console.error)
