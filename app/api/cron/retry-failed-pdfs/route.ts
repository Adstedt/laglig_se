/**
 * Retry Failed PDFs Cron Job
 *
 * Story 2.28: Unified SFS PDF Sync & Document Classification
 *
 * This endpoint retries fetching PDFs for documents that previously failed.
 * It queries LegalDocuments where metadata.pdf.error is present and attempts
 * to re-fetch the PDF.
 *
 * Runs weekly on Sundays at 6:00 AM UTC (7:00 AM CET / 8:00 AM CEST).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentType } from '@prisma/client'
import { fetchAndStorePdf, type PdfMetadata } from '@/lib/sfs'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron

// Verify cron secret for security
const CRON_SECRET = process.env.CRON_SECRET

interface RetryStats {
  queried: number
  attempted: number
  succeeded: number
  stillFailed: number
  skipped: number
}

const CONFIG = {
  BATCH_SIZE: 50, // Process up to 50 failed PDFs per run
  DELAY_MS: 1500, // 1.5 second delay between retries
}

export async function GET(request: Request) {
  const startTime = new Date()

  // Verify authorization
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stats: RetryStats = {
    queried: 0,
    attempted: 0,
    succeeded: 0,
    stillFailed: 0,
    skipped: 0,
  }

  try {
    console.log(`[RETRY-FAILED-PDFS] ========================================`)
    console.log(`[RETRY-FAILED-PDFS] Starting retry job for failed PDFs`)
    console.log(`[RETRY-FAILED-PDFS] Max batch size: ${CONFIG.BATCH_SIZE}`)
    console.log(`[RETRY-FAILED-PDFS] ========================================`)

    // Query documents with failed PDF fetches
    // Look for documents where metadata contains a pdf object with an error field
    const documentsWithFailedPdfs = await prisma.legalDocument.findMany({
      where: {
        content_type: ContentType.SFS_LAW,
        metadata: {
          path: ['pdf', 'error'],
          not: { equals: null },
        },
      },
      select: {
        id: true,
        document_number: true,
        publication_date: true,
        metadata: true,
      },
      take: CONFIG.BATCH_SIZE,
      orderBy: {
        updated_at: 'asc', // Oldest failures first
      },
    })

    stats.queried = documentsWithFailedPdfs.length
    console.log(
      `[RETRY-FAILED-PDFS] Found ${stats.queried} documents with failed PDFs`
    )

    if (documentsWithFailedPdfs.length === 0) {
      console.log(`[RETRY-FAILED-PDFS] No failed PDFs to retry`)

      return NextResponse.json({
        success: true,
        message: 'No failed PDFs to retry',
        stats,
        duration: `${Math.round((Date.now() - startTime.getTime()) / 1000)}s`,
        timestamp: new Date().toISOString(),
      })
    }

    for (const doc of documentsWithFailedPdfs) {
      stats.attempted++

      // Extract SFS number (e.g., "SFS 2025:1581" -> "2025:1581")
      const sfsNumber = doc.document_number.replace(/^SFS\s*/i, '')
      const metadata = doc.metadata as Record<string, unknown>
      const existingPdfMeta = metadata?.pdf as PdfMetadata | undefined

      console.log(`[RETRY-FAILED-PDFS] Retrying: ${doc.document_number}`)
      console.log(
        `[RETRY-FAILED-PDFS]   Previous error: ${existingPdfMeta?.error || 'unknown'}`
      )

      try {
        // Retry the PDF fetch
        const pdfResult = await fetchAndStorePdf(
          sfsNumber,
          doc.publication_date
        )

        if (pdfResult.success && pdfResult.metadata) {
          stats.succeeded++

          // Update the document with successful PDF metadata
          // Spread metadata to satisfy Prisma's JSON type requirements
          await prisma.legalDocument.update({
            where: { id: doc.id },
            data: {
              metadata: {
                ...(metadata || {}),
                pdf: { ...pdfResult.metadata },
              },
              updated_at: new Date(),
            },
          })

          console.log(
            `[RETRY-FAILED-PDFS] ✓ Success: ${doc.document_number} -> ${pdfResult.metadata.storagePath}`
          )
        } else {
          stats.stillFailed++

          // Update with new error info
          const errorMeta: PdfMetadata = {
            storagePath: existingPdfMeta?.storagePath || '',
            storageBucket: 'sfs-pdfs',
            originalUrl:
              pdfResult.metadata?.originalUrl ||
              existingPdfMeta?.originalUrl ||
              '',
            fileSize: 0,
            fetchedAt: new Date().toISOString(),
            error: pdfResult.error || 'Unknown error during retry',
          }

          await prisma.legalDocument.update({
            where: { id: doc.id },
            data: {
              metadata: {
                ...(metadata || {}),
                pdf: { ...errorMeta },
              },
              updated_at: new Date(),
            },
          })

          console.log(
            `[RETRY-FAILED-PDFS] ✗ Still failed: ${doc.document_number} - ${pdfResult.error}`
          )
        }
      } catch (err) {
        stats.stillFailed++
        console.error(
          `[RETRY-FAILED-PDFS] Error retrying ${doc.document_number}:`,
          err
        )
      }

      // Rate limiting delay
      await new Promise((resolve) => setTimeout(resolve, CONFIG.DELAY_MS))
    }

    const duration = Date.now() - startTime.getTime()
    const durationStr = `${Math.round(duration / 1000)}s`

    console.log(`[RETRY-FAILED-PDFS] `)
    console.log(`[RETRY-FAILED-PDFS] ============ SUMMARY ============`)
    console.log(`[RETRY-FAILED-PDFS] Queried:       ${stats.queried}`)
    console.log(`[RETRY-FAILED-PDFS] Attempted:     ${stats.attempted}`)
    console.log(`[RETRY-FAILED-PDFS] Succeeded:     ${stats.succeeded}`)
    console.log(`[RETRY-FAILED-PDFS] Still failed:  ${stats.stillFailed}`)
    console.log(`[RETRY-FAILED-PDFS] Duration:      ${durationStr}`)
    console.log(`[RETRY-FAILED-PDFS] =====================================`)

    return NextResponse.json({
      success: true,
      stats,
      duration: durationStr,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[RETRY-FAILED-PDFS] Job failed:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        stats,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
