/* eslint-disable no-console */
/**
 * Ingest Missing SFS Laws
 *
 * Fetches the 55 historical SFS laws (1827-1911) that are not available
 * through the data.riksdagen.se Open Data API but exist on www.riksdagen.se
 *
 * Usage:
 *   pnpm tsx scripts/ingest-missing-sfs.ts
 */

import { prisma } from '../lib/prisma'
import { ContentType, DocumentStatus } from '@prisma/client'

// The 55 missing SFS numbers identified by find-missing-sfs.ts
const MISSING_SFS = [
  'SFS 1827:60 s.1007',
  'SFS 1828:79 s.1553',
  'SFS 1829:49 s. 279',
  'SFS 1834:30 s. 3',
  'SFS 1844:50 s.2',
  'SFS 1845:50 s.1',
  'SFS 1848:61 s.2',
  'SFS 1851:55 s.4',
  'SFS 1855:82 s.1',
  'SFS 1860:49 s. 3',
  'SFS 1861:23 s.1',
  'SFS 1861:29 s. 1',
  'SFS 1863:83 s.6',
  'SFS 1864:11 s. 101',
  'SFS 1866:37 s.1',
  'SFS 1867:9 s.7',
  'SFS 1870:10 s. 1',
  'SFS 1870:37 s.1',
  'SFS 1872:55 s.2',
  'SFS 1874:26 s.11',
  'SFS 1878:bih. 56 s. 1',
  'SFS 1880:48 s. 1',
  'SFS 1883:bih. 39 s. 1',
  'SFS 1884:13 s.2',
  'SFS 1885:56 s.1',
  'SFS 1891:35 s.1',
  'SFS 1895:bih. 10 s. 1',
  'SFS 1895:bih. 52 s. 1',
  'SFS 1898:50 s.2',
  'SFS 1898:64 s.10',
  'SFS 1899:12 s.9',
  'SFS 1899:bih. 25',
  'SFS 1899:bih. 40 s. 3',
  'SFS 1900:63 s.25',
  'SFS 1901:bih. 56 s. 1',
  'SFS 1902:71 s.1',
  'SFS 1904:12 s.3',
  'SFS 1904:26 s.1',
  'SFS 1904:48 s.1',
  'SFS 1904:60 s. 1',
  'SFS 1905:31 s.1',
  'SFS 1905:38 s.1',
  'SFS 1906:12 s. 1',
  'SFS 1906:60 s. 1',
  'SFS 1907:15 s.1',
  'SFS 1907:36 s. 22',
  'SFS 1908:128 s.1',
  'SFS 1908:74 s.1',
  'SFS 1909:24 s.1',
  'SFS 1909:53 s. 7',
  'SFS 1909:bih. 29 s.1',
  'SFS 1910:103 s.1',
  'SFS 1910:30 s.1',
  'SFS 1910:72 s.1',
  'SFS 1911:53 s.1',
]

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 1000 // 1 second between requests

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Convert SFS number to the document ID format used in riksdagen.se URLs
 * "SFS 1905:38 s.1" -> "sfs-1905-38 s.1"
 */
function sfsToDocId(sfsNumber: string): string {
  // Remove "SFS " prefix and replace : with -
  return 'sfs-' + sfsNumber.substring(4).replace(':', '-')
}

/**
 * Fetch law page from www.riksdagen.se and extract content
 */
async function fetchLawFromWebsite(sfsNumber: string): Promise<{
  title: string
  htmlContent: string
  fullText: string
  publicationDate: Date | null
  sourceUrl: string
} | null> {
  const docId = sfsToDocId(sfsNumber)
  const url = `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/_${encodeURIComponent(docId)}`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
        Accept: 'text/html',
      },
    })

    if (!response.ok) {
      console.error(`  HTTP ${response.status} for ${url}`)
      return null
    }

    const html = await response.text()

    // Extract title from <title> tag or <h1>
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    let title = titleMatch ? titleMatch[1].trim() : sfsNumber

    // Clean up title - remove "| Sveriges riksdag" suffix
    title = title.replace(/\s*\|\s*Sveriges riksdag\s*$/i, '').trim()

    // Extract the main content area
    // The law text is typically in a <div class="LawContent"> or similar
    let contentHtml = ''
    let fullText = ''

    // Try to extract the document content
    // Pattern 1: Look for the law text container
    const contentMatch =
      html.match(
        /<div[^>]*class="[^"]*document-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/main>/i
      ) ||
      html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
      html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)

    if (contentMatch) {
      contentHtml = contentMatch[1]
      // Convert HTML to plain text
      fullText = contentHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
        .replace(/\s+/g, ' ')
        .trim()
    }

    // If we couldn't extract content properly, use the full body
    if (!fullText || fullText.length < 100) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      if (bodyMatch) {
        contentHtml = bodyMatch[1]
        fullText = contentHtml
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
      }
    }

    // Extract publication date from metadata or content
    // Pattern: "Utfärdad: 1905-03-16" or similar
    let publicationDate: Date | null = null
    const dateMatch =
      html.match(/Utf[äa]rdad[:\s]+(\d{4})-(\d{2})-(\d{2})/i) ||
      html.match(/Utfärdad[:\s]+(\d{4})-(\d{2})-(\d{2})/i) ||
      html.match(/(\d{4})-(\d{2})-(\d{2})/)

    if (dateMatch) {
      const year = parseInt(dateMatch[1])
      const month = parseInt(dateMatch[2]) - 1
      const day = parseInt(dateMatch[3])
      publicationDate = new Date(year, month, day)
    } else {
      // Extract year from SFS number
      const yearMatch = sfsNumber.match(/SFS (\d{4}):/)
      if (yearMatch) {
        publicationDate = new Date(parseInt(yearMatch[1]), 0, 1)
      }
    }

    return {
      title,
      htmlContent: contentHtml || html,
      fullText,
      publicationDate,
      sourceUrl: url,
    }
  } catch (error) {
    console.error(
      `  Error fetching ${url}:`,
      error instanceof Error ? error.message : error
    )
    return null
  }
}

/**
 * Generate a URL-friendly slug from title and SFS number
 */
function generateSlug(title: string, sfsNumber: string): string {
  // Extract year and number from SFS number
  const match = sfsNumber.match(/SFS (\d{4}):(.+)/)
  if (!match) {
    return sfsNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }

  const year = match[1]
  const number = match[2].replace(/[^a-z0-9]+/gi, '-').toLowerCase()

  // Clean up title for slug
  const cleanTitle = title
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/[ö]/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)

  return `${year}-${number}-${cleanTitle}`
}

async function ingestMissingSFS() {
  console.log('='.repeat(80))
  console.log('Ingesting Missing SFS Laws from www.riksdagen.se')
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
      console.log(`  ⏭️  Already exists, skipping`)
      skipped++
      continue
    }

    // Fetch from website
    const lawData = await fetchLawFromWebsite(sfsNumber)

    if (!lawData) {
      console.log(`  ❌ Failed to fetch`)
      failed++
      continue
    }

    if (!lawData.fullText || lawData.fullText.length < 50) {
      console.log(`  ⚠️  No usable content found`)
      failed++
      continue
    }

    // Generate slug
    const slug = generateSlug(lawData.title, sfsNumber)

    // Insert into database
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
            source: 'www.riksdagen.se',
            fetchedAt: new Date().toISOString(),
            note: 'Historical law not available through Open Data API',
          },
        },
      })

      console.log(`  ✅ Inserted: ${lawData.title.substring(0, 60)}...`)
      inserted++
    } catch (error) {
      console.error(
        `  ❌ Database error:`,
        error instanceof Error ? error.message : error
      )
      failed++
    }

    // Rate limiting
    if (i < MISSING_SFS.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS)
    }
  }

  console.log('')
  console.log('='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log(`✅ Inserted: ${inserted}`)
  console.log(`⏭️  Skipped:  ${skipped}`)
  console.log(`❌ Failed:   ${failed}`)
  console.log('')

  // Verify final count
  const finalCount = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  console.log(`📊 Total SFS_LAW in database: ${finalCount}`)

  await prisma.$disconnect()
}

ingestMissingSFS().catch(console.error)
