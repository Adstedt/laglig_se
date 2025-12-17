/**
 * Retry PDF downloads for amendments that failed with URL errors
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { parsePdf } from '../lib/external/pdf-parser'
import { uploadPdf, getStoragePath } from '../lib/supabase/storage'

const prisma = new PrismaClient()

async function fetchPdf(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
      Accept: 'application/pdf',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

/**
 * Try to find the PDF URL by scraping the HTML page
 */
async function findPdfUrl(sfsNumber: string): Promise<string | null> {
  // Extract year and number: "SFS 2020:89" -> { year: "2020", num: "89" }
  const match = sfsNumber.match(/SFS (\d{4}):(\d+)/)
  if (!match) return null

  const [, year, num] = match
  const htmlUrl = `https://svenskforfattningssamling.se/doc/${year}${num}.html`

  try {
    const response = await fetch(htmlUrl, {
      headers: { 'User-Agent': 'Laglig.se/1.0' },
    })
    if (!response.ok) return null

    const html = await response.text()

    // Look for PDF link in the HTML
    const pdfMatch = html.match(/href="\.\.([^"]+\.pdf)"/i)
    if (pdfMatch) {
      return `https://svenskforfattningssamling.se${pdfMatch[1]}`
    }
  } catch {
    // Ignore errors
  }

  return null
}

async function main() {
  // Get documents with URL/download failures (no full_text means PDF wasn't downloaded)
  const failed = await prisma.amendmentDocument.findMany({
    where: {
      parse_status: 'FAILED',
      full_text: null,
    },
    select: {
      id: true,
      sfs_number: true,
      original_url: true,
    },
  })

  console.log(`Found ${failed.length} documents with URL failures\n`)

  let succeeded = 0
  let stillFailed = 0
  const errors: Array<{ sfs: string; error: string }> = []

  for (const doc of failed) {
    process.stdout.write(`${doc.sfs_number}... `)

    // Try to construct URL if missing
    let pdfUrl = doc.original_url
    if (!pdfUrl) {
      // Construct URL from SFS number: "SFS 2020:89" -> "https://svenskforfattningssamling.se/sites/default/files/sfs/2020/89.pdf"
      const match = doc.sfs_number.match(/SFS (\d{4}):(\d+)/)
      if (match) {
        pdfUrl = `https://svenskforfattningssamling.se/sites/default/files/sfs/${match[1]}/${match[2]}.pdf`
      }
    }

    if (!pdfUrl) {
      console.log('NO URL')
      stillFailed++
      errors.push({ sfs: doc.sfs_number, error: 'No URL available' })
      continue
    }

    try {
      let pdfBuffer: Buffer | null = null

      // Try the original URL first
      try {
        pdfBuffer = await fetchPdf(pdfUrl)
      } catch {
        // If that fails, try to find the PDF URL from the HTML page
        console.log('trying HTML scrape... ')
        const scrapedUrl = await findPdfUrl(doc.sfs_number)
        if (scrapedUrl) {
          process.stdout.write(`found ${scrapedUrl.split('/').pop()}... `)
          pdfBuffer = await fetchPdf(scrapedUrl)
          pdfUrl = scrapedUrl // Update URL for storage
        }
      }

      if (!pdfBuffer) {
        throw new Error('Could not download PDF from any source')
      }

      // Upload to storage
      await uploadPdf(doc.sfs_number, pdfBuffer)

      // Extract text
      const pdfData = new Uint8Array(pdfBuffer)
      const pdfResult = await parsePdf(pdfData, `${doc.sfs_number}.pdf`)

      // Update document with text
      await prisma.amendmentDocument.update({
        where: { id: doc.id },
        data: {
          storage_path: getStoragePath(doc.sfs_number),
          original_url: pdfUrl,
          file_size: pdfBuffer.length,
          full_text: pdfResult.fullText,
          parse_status: 'PENDING', // Ready for LLM parsing
          parse_error: null,
        },
      })

      console.log(`OK (${pdfBuffer.length} bytes)`)
      succeeded++
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.log(`FAILED: ${errorMsg.substring(0, 50)}`)
      stillFailed++
      errors.push({ sfs: doc.sfs_number, error: errorMsg })

      // Update error message
      await prisma.amendmentDocument.update({
        where: { id: doc.id },
        data: { parse_error: `Retry failed: ${errorMsg}` },
      })
    }

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 500))
  }

  console.log('\n' + '='.repeat(50))
  console.log('RETRY COMPLETE')
  console.log('='.repeat(50))
  console.log(`Succeeded: ${succeeded}`)
  console.log(`Still failed: ${stillFailed}`)

  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach((e) => console.log(`  ${e.sfs}: ${e.error}`))
  }

  // Show stats
  const stats = await prisma.amendmentDocument.groupBy({
    by: ['parse_status'],
    _count: true,
  })
  console.log('\nDatabase stats:')
  stats.forEach((s) => console.log(`  ${s.parse_status}: ${s._count}`))

  await prisma.$disconnect()
}

main().catch(console.error)
