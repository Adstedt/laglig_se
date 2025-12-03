/* eslint-disable no-console */
/**
 * Ingest Remaining SFS Laws
 *
 * Fetches the remaining missing SFS laws:
 * - 6 historical "bih." (bilaga/appendix) laws with special URL encoding
 * - 15 new 2025 laws added after our initial ingestion
 *
 * Usage:
 *   pnpm tsx scripts/ingest-remaining-sfs.ts
 */

import { prisma } from '../lib/prisma'
import { ContentType, DocumentStatus } from '@prisma/client'
import { fetchSFSLaws, fetchLawFullText, fetchLawHTML, generateSlug } from '../lib/external/riksdagen'

// Remaining missing SFS numbers
const MISSING_SFS = [
  // Historical "bih." laws - need special URL handling
  'SFS 1878:bih. 56 s. 1',
  'SFS 1883:bih. 39 s. 1',
  'SFS 1895:bih. 10 s. 1',
  'SFS 1895:bih. 52 s. 1',
  'SFS 1899:bih. 40 s. 3',
  'SFS 1901:bih. 56 s. 1',
  // New 2025 laws (added after initial ingestion)
  'SFS 2025:1246',
  'SFS 2025:1249',
  'SFS 2025:1254',
  'SFS 2025:1255',
  'SFS 2025:1256',
  'SFS 2025:1257',
  'SFS 2025:1258',
  'SFS 2025:1267',
  'SFS 2025:1268',
  'SFS 2025:1280',
  'SFS 2025:1306',
  'SFS 2025:1334',
  'SFS 2025:1342',
  'SFS 2025:1377',
  'SFS 2025:1378',
]

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Convert SFS number to document ID for www.riksdagen.se
 * Handles special "bih." (bilaga) format
 */
function sfsToDocId(sfsNumber: string): string {
  // Remove "SFS " prefix
  let id = sfsNumber.substring(4)
  // Replace : with -
  id = id.replace(':', '-')
  return 'sfs-' + id
}

/**
 * Fetch historical law from www.riksdagen.se
 */
async function fetchHistoricalLaw(sfsNumber: string): Promise<{
  title: string
  htmlContent: string
  fullText: string
  publicationDate: Date | null
  sourceUrl: string
} | null> {
  const docId = sfsToDocId(sfsNumber)
  // Try multiple URL encodings for "bih." documents
  const urlVariants = [
    `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/_${encodeURIComponent(docId)}`,
    `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/_${docId.replace(/ /g, '%20')}`,
  ]

  for (const url of urlVariants) {
    try {
      console.log(`  Trying: ${url}`)
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Laglig.se/1.0 (Legal research)',
          Accept: 'text/html',
        },
      })

      if (!response.ok) {
        console.log(`  HTTP ${response.status}`)
        continue
      }

      const html = await response.text()

      // Extract title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
      let title = titleMatch ? titleMatch[1].trim() : sfsNumber
      title = title.replace(/\s*\|\s*Sveriges riksdag\s*$/i, '').trim()

      // Extract content
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      let contentHtml = bodyMatch ? bodyMatch[1] : html

      // Convert to plain text
      let fullText = contentHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
        .replace(/\s+/g, ' ')
        .trim()

      // Extract publication date
      let publicationDate: Date | null = null
      const dateMatch = html.match(/Utf[äa]rdad[:\s]+(\d{4})-(\d{2})-(\d{2})/i)
      if (dateMatch) {
        publicationDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]))
      } else {
        const yearMatch = sfsNumber.match(/SFS (\d{4}):/)
        if (yearMatch) {
          publicationDate = new Date(parseInt(yearMatch[1]), 0, 1)
        }
      }

      if (fullText.length > 100) {
        return { title, htmlContent: contentHtml, fullText, publicationDate, sourceUrl: url }
      }
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : error}`)
    }
  }
  return null
}

/**
 * Fetch new 2025 law from Open Data API
 */
async function fetchNewLawFromAPI(sfsNumber: string): Promise<{
  title: string
  htmlContent: string | null
  fullText: string | null
  publicationDate: Date | null
  sourceUrl: string
  dokId: string
} | null> {
  // Search for this specific law in the API
  // We need to find it by fetching recent laws and matching
  const year = sfsNumber.match(/SFS (\d{4}):/)
  if (!year) return null

  // Fetch the most recent page to find this law
  for (let page = 1; page <= 5; page++) {
    const result = await fetchSFSLaws(100, page, 'desc')
    const law = result.laws.find(l => l.sfsNumber === sfsNumber)
    if (law) {
      const [htmlContent, fullText] = await Promise.all([
        fetchLawHTML(law.dokId),
        fetchLawFullText(law.dokId),
      ])
      return {
        title: law.title,
        htmlContent,
        fullText,
        publicationDate: law.publicationDate,
        sourceUrl: law.sourceUrl,
        dokId: law.dokId,
      }
    }
  }
  return null
}

async function main() {
  console.log('='.repeat(80))
  console.log('Ingesting Remaining SFS Laws')
  console.log('='.repeat(80))
  console.log(`Total to process: ${MISSING_SFS.length}`)
  console.log('')

  let inserted = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < MISSING_SFS.length; i++) {
    const sfsNumber = MISSING_SFS[i]
    console.log(`[${i + 1}/${MISSING_SFS.length}] Processing ${sfsNumber}...`)

    // Check if already exists
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: sfsNumber },
    })

    if (existing) {
      console.log(`  ⏭️  Already exists`)
      skipped++
      continue
    }

    // Determine fetch method
    const isHistorical = sfsNumber.includes('bih.')
    const isNew2025 = sfsNumber.startsWith('SFS 2025:')

    let lawData: {
      title: string
      htmlContent: string | null
      fullText: string | null
      publicationDate: Date | null
      sourceUrl: string
      dokId?: string
    } | null = null

    if (isHistorical) {
      lawData = await fetchHistoricalLaw(sfsNumber)
    } else if (isNew2025) {
      lawData = await fetchNewLawFromAPI(sfsNumber)
    }

    if (!lawData || (!lawData.fullText && !lawData.htmlContent)) {
      console.log(`  ❌ Failed to fetch content`)
      failed++
      continue
    }

    // Generate slug
    const slug = generateSlug(lawData.title, sfsNumber)

    try {
      await prisma.legalDocument.create({
        data: {
          document_number: sfsNumber,
          title: lawData.title,
          slug,
          content_type: ContentType.SFS_LAW,
          full_text: lawData.fullText,
          html_content: lawData.htmlContent,
          publication_date: lawData.publicationDate,
          status: DocumentStatus.ACTIVE,
          source_url: lawData.sourceUrl,
          metadata: {
            dokId: lawData.dokId || null,
            source: isHistorical ? 'www.riksdagen.se' : 'data.riksdagen.se',
            fetchedAt: new Date().toISOString(),
          },
        },
      })

      console.log(`  ✅ Inserted: ${lawData.title.substring(0, 50)}...`)
      inserted++
    } catch (error) {
      console.error(`  ❌ DB error:`, error instanceof Error ? error.message : error)
      failed++
    }

    await sleep(DELAY_BETWEEN_REQUESTS)
  }

  console.log('')
  console.log('='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log(`✅ Inserted: ${inserted}`)
  console.log(`⏭️  Skipped:  ${skipped}`)
  console.log(`❌ Failed:   ${failed}`)

  // Final count
  const finalCount = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  console.log(`\n📊 Total SFS_LAW in database: ${finalCount}`)

  await prisma.$disconnect()
}

main().catch(console.error)
