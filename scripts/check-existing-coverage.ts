import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface DocumentRefs {
  sfs: Array<{ sfsNumber: string; templates: string[] }>
  afs: Array<{ afsNumber: string; templates: string[] }>
  euEg: Array<{ regulation: string; templates: string[] }>
  otherAgency: Array<{ agencyNumber: string; templates: string[] }>
  other: Array<{ value: string; templates: string[] }>
}

async function main() {
  const refsPath = path.join(
    process.cwd(),
    'data/notisum-amnesfokus/document-references.json'
  )
  const refs: DocumentRefs = JSON.parse(fs.readFileSync(refsPath, 'utf-8'))

  console.log('=== COVERAGE ANALYSIS ===\n')

  // Check SFS coverage
  console.log('--- SFS DOCUMENTS ---')
  const sfsNumbers = refs.sfs.map((r) => `SFS ${r.sfsNumber}`)
  const existingSfs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
      document_number: { in: sfsNumbers },
    },
    select: { document_number: true, title: true },
  })

  const existingSfsSet = new Set(existingSfs.map((d) => d.document_number))
  const missingSfs = sfsNumbers.filter((n) => !existingSfsSet.has(n))

  console.log(`Total referenced: ${sfsNumbers.length}`)
  console.log(`Existing in DB: ${existingSfs.length}`)
  console.log(`Missing: ${missingSfs.length}`)
  if (missingSfs.length > 0 && missingSfs.length <= 20) {
    console.log(`Missing SFS: ${missingSfs.join(', ')}`)
  }

  // Check agency regulations (AFS + other agencies)
  console.log('\n--- AGENCY REGULATIONS (AFS + Others) ---')
  const allAgencyRefs = [
    ...refs.afs.map((r) => r.afsNumber),
    ...refs.otherAgency.map((r) => r.agencyNumber),
  ]
  const existingAgency = await prisma.legalDocument.findMany({
    where: {
      content_type: 'AGENCY_REGULATION',
      document_number: { in: allAgencyRefs },
    },
    select: { document_number: true, title: true },
  })

  const existingAgencySet = new Set(
    existingAgency.map((d) => d.document_number)
  )

  // AFS breakdown
  console.log('\nAFS:')
  const afsNumbers = refs.afs.map((r) => r.afsNumber)
  const existingAfsCount = afsNumbers.filter((n) =>
    existingAgencySet.has(n)
  ).length
  const missingAfs = afsNumbers.filter((n) => !existingAgencySet.has(n))

  console.log(
    `  Total: ${afsNumbers.length}, Existing: ${existingAfsCount}, Missing: ${missingAfs.length}`
  )
  if (missingAfs.length > 0) {
    console.log(`  Missing: ${missingAfs.join(', ')}`)
  }

  // Group other agencies by type
  const agencyDocs = refs.otherAgency
    .map((r) => {
      const match = r.agencyNumber.match(/^([A-ZÄÖÅ-]+)\s+(.+)$/)
      if (match) {
        return { type: match[1], fullNumber: r.agencyNumber }
      }
      return null
    })
    .filter(Boolean) as Array<{ type: string; fullNumber: string }>

  const byAgency = agencyDocs.reduce(
    (acc, doc) => {
      if (!acc[doc.type]) acc[doc.type] = []
      acc[doc.type].push(doc.fullNumber)
      return acc
    },
    {} as Record<string, string[]>
  )

  for (const [agency, numbers] of Object.entries(byAgency).sort()) {
    const existingCount = numbers.filter((n) => existingAgencySet.has(n)).length
    const missing = numbers.filter((n) => !existingAgencySet.has(n))

    console.log(`\n${agency}:`)
    console.log(
      `  Total: ${numbers.length}, Existing: ${existingCount}, Missing: ${missing.length}`
    )
    if (missing.length > 0) {
      console.log(`  Missing: ${missing.join(', ')}`)
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===')
  const totalRefs = refs.sfs.length + refs.afs.length + refs.otherAgency.length
  const totalExisting = existingSfs.length + existingAgency.length
  const coverage = ((totalExisting / totalRefs) * 100).toFixed(1)

  console.log(`Total documents referenced (SFS + Agency): ${totalRefs}`)
  console.log(`Total in database: ${totalExisting}`)
  console.log(`  - SFS: ${existingSfs.length}/${sfsNumbers.length}`)
  console.log(
    `  - Agency: ${existingAgency.length}/${refs.afs.length + refs.otherAgency.length}`
  )
  console.log(`Coverage: ${coverage}%`)
  console.log(
    `\nNote: EU/EG regulations (${refs.euEg.length}) not checked (typically external references)`
  )
  console.log(
    `Note: Unrecognized references (${refs.other.length}) not checked`
  )

  await prisma.$disconnect()
}

main().catch(console.error)
