#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 9.2 — Download Agency Regulation PDFs
 *
 * Generic download script for MSBFS and NFS regulation PDFs.
 * Stores PDFs in data/{authority}-pdfs/.
 *
 * Usage:
 *   npx tsx scripts/download-agency-pdfs.ts --authority msbfs
 *   npx tsx scripts/download-agency-pdfs.ts --authority nfs
 *   npx tsx scripts/download-agency-pdfs.ts --authority msbfs --dry-run
 *   npx tsx scripts/download-agency-pdfs.ts --authority msbfs --force
 *   npx tsx scripts/download-agency-pdfs.ts --authority msbfs --limit 3
 *   npx tsx scripts/download-agency-pdfs.ts --authority msbfs --filter 2024:10
 */

import * as fs from 'fs'
import * as path from 'path'
import { resolve } from 'path'
import { fileURLToPath } from 'node:url'
import {
  type AgencyAuthority,
  type AgencyPdfDocument,
  SUPPORTED_AUTHORITIES,
  getRegistryByAuthority,
  getPdfFileName,
} from '../lib/agency/agency-pdf-registry'

// ============================================================================
// CLI Configuration
// ============================================================================

interface DownloadConfig {
  authority: AgencyAuthority
  dryRun: boolean
  force: boolean
  limit: number
  filter: string | null
}

function parseArgs(): DownloadConfig {
  const config: DownloadConfig = {
    authority: 'msbfs',
    dryRun: false,
    force: false,
    limit: 0,
    filter: null,
  }

  const argv = process.argv.slice(2)
  let hasAuthority = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--authority' && argv[i + 1]) {
      const value = argv[i + 1]!.toLowerCase()
      if (!SUPPORTED_AUTHORITIES.includes(value as AgencyAuthority)) {
        console.error(
          `Unknown authority: ${value}. Supported: ${SUPPORTED_AUTHORITIES.join(', ')}`
        )
        process.exit(1)
      }
      config.authority = value as AgencyAuthority
      hasAuthority = true
      i++
    } else if (arg === '--dry-run') {
      config.dryRun = true
    } else if (arg === '--force') {
      config.force = true
    } else if (arg === '--limit' && argv[i + 1]) {
      config.limit = parseInt(argv[i + 1]!, 10)
      i++
    } else if (arg === '--filter' && argv[i + 1]) {
      config.filter = argv[i + 1]!
      i++
    }
  }

  if (!hasAuthority) {
    console.error('Required: --authority msbfs|nfs')
    process.exit(1)
  }

  return config
}

// ============================================================================
// Download Logic
// ============================================================================

function getOutputDir(authority: AgencyAuthority): string {
  return path.resolve(__dirname, `../data/${authority}-pdfs`)
}

async function downloadPdf(
  doc: AgencyPdfDocument,
  outputPath: string,
  config: DownloadConfig
): Promise<{ success: boolean; size: number; skipped: boolean }> {
  if (config.dryRun) {
    console.log(`  [DRY RUN] Would download: ${doc.pdfUrl}`)
    console.log(`            → ${outputPath}`)
    return { success: true, size: 0, skipped: false }
  }

  // Check if already downloaded
  if (!config.force && fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath)
    console.log(
      `  [SKIP] Already exists: ${getPdfFileName(doc.documentNumber)} (${(stats.size / 1024).toFixed(0)} KB)`
    )
    return { success: true, size: stats.size, skipped: true }
  }

  try {
    const response = await fetch(doc.pdfUrl, {
      headers: {
        'User-Agent':
          'Laglig.se/1.0 (legal compliance platform; contact@laglig.se)',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      console.error(
        `  [FAIL] HTTP ${response.status} for ${doc.documentNumber}: ${doc.pdfUrl}`
      )
      return { success: false, size: 0, skipped: false }
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Verify it looks like a PDF
    if (
      buffer.length < 100 ||
      !buffer.subarray(0, 5).toString().startsWith('%PDF')
    ) {
      console.error(
        `  [FAIL] Not a valid PDF for ${doc.documentNumber} (${buffer.length} bytes)`
      )
      return { success: false, size: 0, skipped: false }
    }

    fs.writeFileSync(outputPath, buffer)
    console.log(
      `  [OK] Downloaded: ${getPdfFileName(doc.documentNumber)} (${(buffer.length / 1024).toFixed(0)} KB)`
    )

    return { success: true, size: buffer.length, skipped: false }
  } catch (error) {
    console.error(
      `  [FAIL] Download error for ${doc.documentNumber}:`,
      error instanceof Error ? error.message : error
    )
    return { success: false, size: 0, skipped: false }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs()
  const startTime = Date.now()
  const outputDir = getOutputDir(config.authority)
  const registry = getRegistryByAuthority(config.authority)

  console.log('='.repeat(60))
  console.log(`Agency PDF Download Script — ${config.authority.toUpperCase()}`)
  console.log('='.repeat(60))
  console.log(`Authority: ${config.authority.toUpperCase()}`)
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Force: ${config.force}`)
  console.log(`Output: ${outputDir}`)
  if (config.filter) console.log(`Filter: ${config.filter}`)
  if (config.limit > 0) console.log(`Limit: ${config.limit}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log()

  // Ensure output directory exists
  if (!config.dryRun) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Filter documents
  let documents = [...registry]
  if (config.filter) {
    const filterNormalized = config.filter.replace(/\s+/g, '').toUpperCase()
    documents = documents.filter((d) =>
      d.documentNumber
        .replace(/\s+/g, '')
        .toUpperCase()
        .includes(filterNormalized)
    )
  }
  if (config.limit > 0) {
    documents = documents.slice(0, config.limit)
  }

  console.log(
    `--- Downloading ${documents.length} of ${registry.length} PDFs ---`
  )
  console.log()

  let downloaded = 0
  let skipped = 0
  let failed = 0
  let totalSize = 0

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]!
    const fileName = getPdfFileName(doc.documentNumber)
    const outputPath = path.join(outputDir, fileName)

    console.log(
      `[${i + 1}/${documents.length}] ${doc.documentNumber}: ${doc.title}`
    )
    if (doc.isConsolidated) {
      console.log(`  (konsoliderad version)`)
    }
    if (doc.notes) {
      console.log(`  Note: ${doc.notes}`)
    }

    const result = await downloadPdf(doc, outputPath, config)

    if (result.success) {
      if (result.skipped) {
        skipped++
      } else {
        downloaded++
      }
      totalSize += result.size
    } else {
      failed++
    }

    // Rate limit: 1 second between requests
    if (!config.dryRun && i < documents.length - 1) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log()
  console.log('--- Results ---')
  console.log(`  Downloaded: ${downloaded}`)
  console.log(`  Skipped (already exists): ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total size: ${(totalSize / (1024 * 1024)).toFixed(1)} MB`)

  // Verify completeness
  if (!config.dryRun && !config.filter && config.limit === 0) {
    console.log()
    console.log('--- Verification ---')
    const expectedFiles = registry.map((d) => getPdfFileName(d.documentNumber))
    const existingFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir)
      : []
    const missing = expectedFiles.filter((f) => !existingFiles.includes(f))

    if (missing.length === 0) {
      console.log(`  All ${expectedFiles.length} PDFs present`)
    } else {
      console.log(`  MISSING ${missing.length} files:`)
      for (const f of missing) {
        console.log(`    - ${f}`)
      }
    }

    // Verify PDF validity
    let valid = 0
    let invalid = 0
    for (const fileName of expectedFiles) {
      const filePath = path.join(outputDir, fileName)
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        const header = Buffer.alloc(5)
        const fd = fs.openSync(filePath, 'r')
        fs.readSync(fd, header, 0, 5, 0)
        fs.closeSync(fd)

        if (stats.size > 0 && header.toString().startsWith('%PDF')) {
          valid++
        } else {
          console.log(
            `  INVALID: ${fileName} (${stats.size} bytes, header: ${header.toString()})`
          )
          invalid++
        }
      }
    }
    console.log(`  Valid PDFs: ${valid}/${expectedFiles.length}`)
    if (invalid > 0) {
      console.log(`  Invalid PDFs: ${invalid}`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log()
  console.log('='.repeat(60))
  console.log(`Done in ${elapsed}s`)
  console.log('='.repeat(60))

  if (failed > 0) {
    process.exit(1)
  }
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isDirectExecution) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
