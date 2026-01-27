import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { createReadStream, writeFileSync } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'

const prisma = new PrismaClient()

async function readBatchFile(filePath: string): Promise<Set<string>> {
  const ids = new Set<string>()
  const fileStream = createReadStream(filePath)
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity })

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const parsed = JSON.parse(line)
        // custom_id format: SFS1998-1000 -> normalize to 1998:1000
        const sfsNumber = parsed.custom_id.replace(/^SFS/, '').replace('-', ':')
        ids.add(sfsNumber)
      } catch (e) {
        // Skip invalid lines
      }
    }
  }
  return ids
}

async function main() {
  // Get all amendments that should be processed
  const amendments = await prisma.amendmentDocument.findMany({
    where: { parse_status: 'COMPLETED' },
    select: { sfs_number: true },
    orderBy: { sfs_number: 'asc' },
  })

  // Check which have html_content
  const existing = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: '' },
    },
    select: { document_number: true },
  })

  const existingSet = new Set(
    existing.map((d) => d.document_number.replace('SFS ', ''))
  )

  const toProcess = amendments
    .filter((a) => !existingSet.has(a.sfs_number))
    .map((a) => a.sfs_number.replace(/^SFS\s*/, '')) // Normalize: "SFS 1998:1000" -> "1998:1000"

  console.log('Total needing processing:', toProcess.length)

  // Read all batch files and extract custom_ids
  const batchFiles = [
    'batches/batch-1767706143848-part1.jsonl',
    'batches/batch-1767706143848-part2.jsonl',
    'batches/batch-1767706143848-part3.jsonl',
    'batches/batch-1767706143848-part4.jsonl',
    'batches/batch-1767706143848-part5.jsonl',
    'batches/batch-1767707457752-part6.jsonl',
    'batches/batch-1767707457752-part7.jsonl',
  ]

  const inBatch = new Set<string>()
  for (const file of batchFiles) {
    try {
      console.log('Reading', file, '...')
      const ids = await readBatchFile(join(process.cwd(), file))
      ids.forEach((id) => inBatch.add(id))
      console.log('  Found', ids.size, 'entries, total now:', inBatch.size)
    } catch (e: any) {
      console.log('Error reading', file, e.message)
    }
  }

  console.log('\nIn batch files:', inBatch.size)

  // Find which ones are missing from batch
  const missing = toProcess.filter((sfs) => !inBatch.has(sfs))
  console.log('Missing from batch (failed downloads):', missing.length)

  if (missing.length > 0 && missing.length < 50) {
    console.log('\nAll missing:')
    missing.forEach((sfs) => console.log(' ', sfs))
  } else if (missing.length > 0) {
    console.log('\nFirst 30 missing:')
    missing.slice(0, 30).forEach((sfs) => console.log(' ', sfs))
  }

  // Save full list of missing
  if (missing.length > 0) {
    writeFileSync('batches/failed-downloads.txt', missing.join('\n'))
    console.log('\nFull list saved to batches/failed-downloads.txt')
  }

  await prisma.$disconnect()
}
main()
