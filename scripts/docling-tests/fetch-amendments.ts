/**
 * Fetch Amendment PDFs for Docling Testing
 *
 * Downloads 5 amendment PDFs that have existing HTML content
 * for comparison with Docling's output.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { downloadPdfByPath } from '@/lib/supabase/storage'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

interface AmendmentWithHtml {
  document_number: string
  title: string | null
  html_content: string
  metadata: {
    storage_path?: string
    pdf?: { storagePath?: string }
  } | null
}

async function main() {
  const outputDir = join(__dirname, 'pdfs')
  const htmlDir = join(__dirname, 'output', 'existing-html')

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  if (!existsSync(htmlDir)) mkdirSync(htmlDir, { recursive: true })

  console.log('Finding amendments with PDF storage path and HTML content...\n')

  // Find amendments that have both html_content AND a PDF storage path
  const amendments = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null },
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
      metadata: true,
    },
    orderBy: { updated_at: 'desc' },
    take: 50, // Get more to filter for ones with storage_path
  })

  console.log(`Found ${amendments.length} amendments with HTML content`)

  // Filter to those with storage path
  const withPdf = amendments.filter((a) => {
    const meta = a.metadata as AmendmentWithHtml['metadata']
    return meta?.storage_path || meta?.pdf?.storagePath
  })

  console.log(`Found ${withPdf.length} amendments with PDF storage path\n`)

  // Take first 5
  const selected = withPdf.slice(0, 5)

  const manifest: Array<{
    sfs: string
    title: string | null
    pdfPath: string
    htmlPath: string
    storagePath: string
  }> = []

  for (const amendment of selected) {
    const sfs = amendment.document_number.replace('SFS ', '')
    const meta = amendment.metadata as AmendmentWithHtml['metadata']
    const storagePath = meta?.storage_path || meta?.pdf?.storagePath

    if (!storagePath) {
      console.log(`⚠️ ${sfs}: No storage path found, skipping`)
      continue
    }

    console.log(`Downloading ${sfs}...`)
    console.log(`  Storage path: ${storagePath}`)

    try {
      const pdfBuffer = await downloadPdfByPath(storagePath)

      if (!pdfBuffer) {
        console.log(`  ❌ Failed to download PDF`)
        continue
      }

      // Save PDF
      const safeName = sfs.replace(':', '-')
      const pdfPath = join(outputDir, `${safeName}.pdf`)
      writeFileSync(pdfPath, pdfBuffer)
      console.log(
        `  ✓ Saved PDF: ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`
      )

      // Save existing HTML for comparison
      const htmlPath = join(htmlDir, `${safeName}.html`)
      writeFileSync(htmlPath, amendment.html_content || '')
      console.log(`  ✓ Saved existing HTML: ${htmlPath}`)

      manifest.push({
        sfs,
        title: amendment.title,
        pdfPath,
        htmlPath,
        storagePath,
      })
    } catch (error) {
      console.log(`  ❌ Error: ${error}`)
    }
  }

  // Save manifest for Python script
  const manifestPath = join(__dirname, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`\n✓ Saved manifest: ${manifestPath}`)
  console.log(`\nReady to process ${manifest.length} PDFs with Docling`)

  await prisma.$disconnect()
}

main().catch(console.error)
