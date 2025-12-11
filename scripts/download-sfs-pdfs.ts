/**
 * Download SFS PDFs and upload to Supabase Storage
 *
 * Story 2.13: Amendment Documents & Historical Versions
 * Phase 2, Task 2.4: Build PDF downloader
 *
 * Usage:
 *   pnpm tsx scripts/download-sfs-pdfs.ts --year 2025
 *   pnpm tsx scripts/download-sfs-pdfs.ts --year 2025 --limit 100
 *   pnpm tsx scripts/download-sfs-pdfs.ts --year 2025 --type amendment
 *   pnpm tsx scripts/download-sfs-pdfs.ts --year 2025 --resume
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import * as fs from 'fs'
import * as path from 'path'
import { uploadPdf, listPdfsForYear } from '../lib/supabase/storage'
import type { CrawlResult, CrawledDocument, DocumentType } from './crawl-sfs-index'

interface DownloadStats {
  total: number
  downloaded: number
  uploaded: number
  skipped: number
  errors: number
  errorList: Array<{ sfsNumber: string; error: string }>
}

async function downloadPdf(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
      Accept: 'application/pdf',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function processDocument(
  doc: CrawledDocument,
  stats: DownloadStats,
  existingPdfs: Set<string>
): Promise<void> {
  // Skip if already uploaded
  if (existingPdfs.has(doc.sfsNumber)) {
    stats.skipped++
    return
  }

  try {
    // Download PDF
    const pdfBuffer = await downloadPdf(doc.pdfUrl)
    stats.downloaded++

    // Upload to Supabase
    const { error } = await uploadPdf(doc.sfsNumber, pdfBuffer)

    if (error) {
      stats.errors++
      stats.errorList.push({ sfsNumber: doc.sfsNumber, error: error.message })
    } else {
      stats.uploaded++
    }
  } catch (error) {
    stats.errors++
    stats.errorList.push({
      sfsNumber: doc.sfsNumber,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let year = 2025
  let limit = 0 // 0 = no limit
  let filterType: DocumentType | null = null
  let resume = false
  let concurrency = 5 // Number of parallel downloads

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--year' && args[i + 1]) {
      year = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--type' && args[i + 1]) {
      filterType = args[i + 1] as DocumentType
      i++
    } else if (args[i] === '--resume') {
      resume = true
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10)
      i++
    }
  }

  console.log('='.repeat(70))
  console.log('SFS PDF Downloader')
  console.log('='.repeat(70))
  console.log(`Year: ${year}`)
  console.log(`Filter: ${filterType || 'all'}`)
  console.log(`Limit: ${limit || 'none'}`)
  console.log(`Resume: ${resume}`)
  console.log(`Concurrency: ${concurrency}`)
  console.log()

  // Load crawl results
  const indexPath = path.join(process.cwd(), 'data', `sfs-index-${year}.json`)

  if (!fs.existsSync(indexPath)) {
    console.error(`Index file not found: ${indexPath}`)
    console.error(`Run: pnpm tsx scripts/crawl-sfs-index.ts --year ${year}`)
    process.exit(1)
  }

  const crawlResult: CrawlResult = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  console.log(`Loaded ${crawlResult.totalDocuments} documents from index`)

  // Filter documents
  let documents = crawlResult.documents

  if (filterType) {
    documents = documents.filter(d => d.documentType === filterType)
    console.log(`Filtered to ${documents.length} ${filterType} documents`)
  }

  if (limit > 0) {
    documents = documents.slice(0, limit)
    console.log(`Limited to ${documents.length} documents`)
  }

  // Check existing uploads if resuming
  let existingPdfs = new Set<string>()

  if (resume) {
    console.log('\nChecking existing uploads...')
    const existing = await listPdfsForYear(year)
    existingPdfs = new Set(existing)
    console.log(`Found ${existingPdfs.size} already uploaded`)
  }

  // Initialize stats
  const stats: DownloadStats = {
    total: documents.length,
    downloaded: 0,
    uploaded: 0,
    skipped: 0,
    errors: 0,
    errorList: [],
  }

  console.log('\nStarting download...\n')
  const startTime = Date.now()

  // Process in batches for concurrency
  for (let i = 0; i < documents.length; i += concurrency) {
    const batch = documents.slice(i, i + concurrency)

    // Rate limiting: 200ms between batches
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Process batch in parallel
    await Promise.all(batch.map(doc => processDocument(doc, stats, existingPdfs)))

    // Progress update
    const processed = Math.min(i + concurrency, documents.length)
    const percent = ((processed / documents.length) * 100).toFixed(1)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(
      `Progress: ${processed}/${documents.length} (${percent}%) - ` +
        `${stats.uploaded} uploaded, ${stats.skipped} skipped, ${stats.errors} errors - ${elapsed}s`
    )
  }

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Total documents: ${stats.total}`)
  console.log(`Downloaded: ${stats.downloaded}`)
  console.log(`Uploaded: ${stats.uploaded}`)
  console.log(`Skipped (already exists): ${stats.skipped}`)
  console.log(`Errors: ${stats.errors}`)
  console.log(`Time: ${totalTime}s`)

  if (stats.errorList.length > 0) {
    console.log('\nErrors:')
    stats.errorList.slice(0, 10).forEach(e => {
      console.log(`  - ${e.sfsNumber}: ${e.error}`)
    })
    if (stats.errorList.length > 10) {
      console.log(`  ... and ${stats.errorList.length - 10} more`)
    }

    // Save error list
    const errorPath = path.join(process.cwd(), 'data', `sfs-download-errors-${year}.json`)
    fs.writeFileSync(errorPath, JSON.stringify(stats.errorList, null, 2))
    console.log(`\nError list saved to: ${errorPath}`)
  }
}

main().catch(console.error)
