#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 9.1 — Task 3: Download Consolidated AFS PDFs
 *
 * Downloads the consolidated (konsoliderad) version of each AFS 2023-series
 * document from av.se. Stores PDFs in data/afs-pdfs/.
 *
 * Usage:
 *   npx tsx scripts/download-afs-consolidated.ts
 *   npx tsx scripts/download-afs-consolidated.ts --dry-run
 *   npx tsx scripts/download-afs-consolidated.ts --limit 3
 *   npx tsx scripts/download-afs-consolidated.ts --force        # Re-download even if file exists
 *   npx tsx scripts/download-afs-consolidated.ts --filter AFS2023:10  # Only this document
 */

import * as fs from 'fs'
import * as path from 'path'
import { resolve } from 'path'
import { fileURLToPath } from 'node:url'
import { AFS_REGISTRY, type AfsDocument } from '../lib/agency/afs-registry'

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_DIR = path.resolve(__dirname, '../data/afs-pdfs')

/**
 * URL mapping for consolidated AFS PDFs on av.se.
 *
 * Each AFS document has a dedicated page on av.se where the consolidated
 * PDF is available for download. These URLs were manually discovered.
 *
 * Format: { documentNumber → { pdfUrl, pageUrl, historikUrl } }
 */
export const AFS_URL_REGISTRY: Record<
  string,
  { pdfUrl: string; basePdfUrl: string; pageUrl: string; historikUrl: string }
> = {
  // No amendments — base PDF only
  'AFS 2023:1': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/systematiskt-arbetsmiljoarbete-grundlaggande-skyldigheter-for-dig-med-arbetsgivaransvar-afs2023-1.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/systematiskt-arbetsmiljoarbete-grundlaggande-skyldigheter-for-dig-med-arbetsgivaransvar-afs2023-1.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20231/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20231/forfattningshistorik-afs-20231/',
  },
  // No amendments — base PDF only
  'AFS 2023:2': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/planering-och-organisering-av-arbetsmiljoarbete-grundlaggande-skyldigheter-for-dig-med-arbetsgivaransvar-afs2023-2.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/planering-och-organisering-av-arbetsmiljoarbete-grundlaggande-skyldigheter-for-dig-med-arbetsgivaransvar-afs2023-2.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20232/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20232/forfattningshistorik-afs-20232/',
  },
  // Consolidated through AFS 2024:1
  'AFS 2023:3': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/konsoliderade-foreskrifter/projektering-och-byggarbetsmiljosamordning-grundlaggande-skyldigheter-afs2023-3-konsoliderad.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/projektering-och-byggarbetsmiljosamordning-grundlaggande-skyldigheter-afs2023-3.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20233/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20233/forfattningshistorik-afs-20233/',
  },
  // Consolidated through AFS 2024:2
  'AFS 2023:4': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/konsoliderade-foreskrifter/produkter-maskiner-afs2023-4-konsoliderad.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/produkter-maskiner-afs2023-4.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20234/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20234/forfattningshistorik-afs-20234/',
  },
  // No amendments — base PDF only
  'AFS 2023:5': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/produkter-tryckbarande-anordningar-afs2023-5.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/produkter-tryckbarande-anordningar-afs2023-5.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20235/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20235/forfattningshistorik-afs-20235/',
  },
  // No amendments — base PDF only
  'AFS 2023:6': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/produkter-enkla-tryckkarl-afs2023-6.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/produkter-enkla-tryckkarl-afs2023-6.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20236/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20236/forfattningshistorik-afs-20236/',
  },
  // No amendments — base PDF only
  'AFS 2023:7': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/produkter-utrustning-for-potentiellt-explosiva-atmosfarer-afs2023-7.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/produkter-utrustning-for-potentiellt-explosiva-atmosfarer-afs2023-7.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20237/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20237/forfattningshistorik-afs-20237/',
  },
  // No amendments — base PDF only
  'AFS 2023:8': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/produkter-forbud-att-pa-marknaden-slappa-ut-ledade-skarverktyg-avsedda-for-barbara-handhallna-rojsagar-afs2023-8.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/produkter-forbud-att-pa-marknaden-slappa-ut-ledade-skarverktyg-avsedda-for-barbara-handhallna-rojsagar-afs2023-8.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20238/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20238/forfattningshistorik-afs-20238/',
  },
  // No amendments — base PDF only
  'AFS 2023:9': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/produkter-stegar-stallningar-och-viss-annan-utrustning-for-arbete-pa-hojd-samt-vissa-trycksatta-anordningar-afs2023-9.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/produkter-stegar-stallningar-och-viss-annan-utrustning-for-arbete-pa-hojd-samt-vissa-trycksatta-anordningar-afs2023-9.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20239/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-20239/forfattningshistorik-afs-20239/',
  },
  // Consolidated through AFS 2025:1 (AFS 2024:3 also incorporated)
  'AFS 2023:10': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/konsoliderade-foreskrifter/risker-i-arbetsmiljon-afs2023-10-konsoliderad.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/risker-i-arbetsmiljon-afs2023-10.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202310/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202310/forfattningshistorik-afs-202310/',
  },
  // Consolidated through AFS 2024:4
  'AFS 2023:11': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/konsoliderade-foreskrifter/arbetsutrustning-och-personlig-skyddsutrustning-saker-anvandning-afs2023-11-konsoliderad.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/arbetsutrustning-och-personlig-skyddsutrustning-saker-anvandning-afs2023-11.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202311/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202311/forfattningshistorik-afs-202311/',
  },
  // No amendments — base PDF only
  'AFS 2023:12': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/utformning-av-arbetsplatser-afs2023-12.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/utformning-av-arbetsplatser-afs2023-12.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202312/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202312/forfattningshistorik-afs-202312/',
  },
  // Consolidated through AFS 2025:8 (AFS 2025:6 also incorporated)
  'AFS 2023:13': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/konsoliderade-foreskrifter/risker-vid-vissa-typer-av-arbeten-afs2023-13-konsoliderad.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/risker-vid-vissa-typer-av-arbeten-afs2023-13.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202313/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202313/forfattningshistorik-afs-202313/',
  },
  // Consolidated through AFS 2025:5
  'AFS 2023:14': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/konsoliderade-foreskrifter/gransvarden-luftvagsexponering-arbetsmiljon-afs2023-14-konsoliderad.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/gransvarden-for-luftvagsexponering-i-arbetsmiljon-afs2023-14.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202314/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202314/forfattningshistorik-afs-202314/',
  },
  // Consolidated through AFS 2025:3, 2025:4, 2025:7
  'AFS 2023:15': {
    pdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/konsoliderade-foreskrifter/medicinska-kontroller-i-arbetslivet-afs2023-15-konsoliderad.pdf',
    basePdfUrl:
      'https://www.av.se/globalassets/filer/publikationer/foreskrifter/medicinska-kontroller-i-arbetslivet-afs2023-15.pdf',
    pageUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202315/',
    historikUrl:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202315/forfattningshistorik-afs-202315/',
  },
}

// ============================================================================
// CLI Configuration
// ============================================================================

interface DownloadConfig {
  dryRun: boolean
  force: boolean
  limit: number
  filter: string | null
}

function parseArgs(): DownloadConfig {
  const config: DownloadConfig = {
    dryRun: false,
    force: false,
    limit: 0,
    filter: null,
  }

  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') {
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

  return config
}

// ============================================================================
// File Naming
// ============================================================================

/**
 * Generate the local file name for an AFS PDF.
 * e.g. "AFS 2023:10" → "AFS-2023-10.pdf"
 */
export function getPdfFileName(documentNumber: string): string {
  return documentNumber.replace(/\s+/g, '-').replace(/:/g, '-') + '.pdf'
}

// ============================================================================
// Download Logic
// ============================================================================

async function downloadPdf(
  url: string,
  outputPath: string,
  doc: AfsDocument,
  config: DownloadConfig
): Promise<{ success: boolean; size: number }> {
  if (config.dryRun) {
    console.log(`  [DRY RUN] Would download: ${url}`)
    console.log(`            → ${outputPath}`)
    return { success: true, size: 0 }
  }

  // Check if already downloaded
  if (!config.force && fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath)
    console.log(
      `  [SKIP] Already exists: ${getPdfFileName(doc.documentNumber)} (${(stats.size / 1024).toFixed(0)} KB)`
    )
    return { success: true, size: stats.size }
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Laglig.se/1.0 (legal compliance platform; contact@laglig.se)',
      },
    })

    if (!response.ok) {
      console.error(
        `  [FAIL] HTTP ${response.status} for ${doc.documentNumber}: ${url}`
      )
      return { success: false, size: 0 }
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
      return { success: false, size: 0 }
    }

    fs.writeFileSync(outputPath, buffer)
    console.log(
      `  [OK] Downloaded: ${getPdfFileName(doc.documentNumber)} (${(buffer.length / 1024).toFixed(0)} KB)`
    )

    return { success: true, size: buffer.length }
  } catch (error) {
    console.error(
      `  [FAIL] Download error for ${doc.documentNumber}:`,
      error instanceof Error ? error.message : error
    )
    return { success: false, size: 0 }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs()
  const startTime = Date.now()

  console.log('='.repeat(60))
  console.log('AFS Consolidated PDF Download Script (Story 9.1)')
  console.log('='.repeat(60))
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Force: ${config.force}`)
  if (config.filter) console.log(`Filter: ${config.filter}`)
  if (config.limit > 0) console.log(`Limit: ${config.limit}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log()

  // Ensure output directory exists
  if (!config.dryRun) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Filter documents
  let documents = [...AFS_REGISTRY]
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
    `--- Downloading ${documents.length} of ${AFS_REGISTRY.length} AFS PDFs ---`
  )
  console.log()

  let downloaded = 0
  let skipped = 0
  let failed = 0
  let totalSize = 0

  for (const doc of documents) {
    const urls = AFS_URL_REGISTRY[doc.documentNumber]
    if (!urls) {
      console.error(`  [WARN] No URL configured for ${doc.documentNumber}`)
      failed++
      continue
    }

    const fileName = getPdfFileName(doc.documentNumber)
    const outputPath = path.join(OUTPUT_DIR, fileName)

    console.log(
      `[${downloaded + skipped + failed + 1}/${documents.length}] ${doc.documentNumber}: ${doc.title}`
    )

    if (doc.consolidatedThrough) {
      console.log(`  Consolidated through: ${doc.consolidatedThrough}`)
    }

    const result = await downloadPdf(urls.pdfUrl, outputPath, doc, config)

    if (result.success) {
      if (result.size === 0 && config.dryRun) {
        downloaded++
      } else if (!config.force && fs.existsSync(outputPath) && !config.dryRun) {
        skipped++
      } else {
        downloaded++
      }
      totalSize += result.size
    } else {
      failed++
    }

    // Rate limit: 1 second between requests
    if (!config.dryRun) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
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
    const expectedFiles = AFS_REGISTRY.map((d) =>
      getPdfFileName(d.documentNumber)
    )
    const existingFiles = fs.existsSync(OUTPUT_DIR)
      ? fs.readdirSync(OUTPUT_DIR)
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
