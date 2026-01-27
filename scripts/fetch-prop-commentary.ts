/**
 * Proof of concept: Fetch proposition and extract Författningskommentar
 * Story 9.1 pre-work
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import * as cheerio from 'cheerio'

interface PropMetadata {
  dokId: string
  title: string
  htmlUrl: string
}

interface SectionCommentary {
  chapter: string | null
  section: string
  commentary: string
}

/**
 * Step 1: Get dok_id from Riksdag API
 */
async function getPropMetadata(
  year: string,
  number: string
): Promise<PropMetadata | null> {
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=prop&rm=${encodeURIComponent(year)}&nr=${number}&utformat=json`

  console.log(`Fetching: ${url}`)

  const res = await fetch(url)
  if (!res.ok) {
    console.error(`Failed to fetch: ${res.status}`)
    return null
  }

  const data = await res.json()
  const doc = data?.dokumentlista?.dokument?.[0]

  if (!doc) {
    console.error('No document found')
    return null
  }

  return {
    dokId: doc.dok_id,
    title: doc.titel,
    htmlUrl: `https://data.riksdagen.se/dokument/${doc.dok_id}.html`,
  }
}

/**
 * Step 2: Fetch full HTML document
 */
async function fetchPropHtml(dokId: string): Promise<string | null> {
  const url = `https://data.riksdagen.se/dokument/${dokId}.html`

  console.log(`Fetching HTML: ${url}`)

  const res = await fetch(url)
  if (!res.ok) {
    console.error(`Failed to fetch HTML: ${res.status}`)
    return null
  }

  return await res.text()
}

/**
 * Step 3: Extract Författningskommentar section
 */
function extractForfattningskommentar(html: string): string | null {
  const $ = cheerio.load(html)

  // Get all text content
  const fullText = $('body').text()

  // Find the Författningskommentar section
  // It typically starts with a numbered heading like "14 Författningskommentar"
  const fkMatch = fullText.match(
    /(\d+)\s+Författningskommentar([\s\S]*?)(?=\d+\s+Bilaga|\d+\s+Sammanfattning av|$)/i
  )

  if (fkMatch) {
    return fkMatch[0].trim()
  }

  return null
}

/**
 * Step 4: Parse section commentaries from the extracted text
 */
function parseSectionCommentaries(text: string): SectionCommentary[] {
  const commentaries: SectionCommentary[] = []

  // Pattern: "35 kap. 1 §" or "1 §" followed by commentary
  // The commentary typically starts with "Paragrafen..." or "I paragrafen..."
  const sectionPattern =
    /(?:(\d+)\s*kap\.\s*)?(\d+\s*[a-z]?)\s*§([^§]*?)(?=(?:\d+\s*kap\.\s*)?\d+\s*[a-z]?\s*§|$)/gi

  let match
  while ((match = sectionPattern.exec(text)) !== null) {
    const chapter = match[1] || null
    const section = match[2].trim()
    let commentary = match[3].trim()

    // Clean up the commentary - take first meaningful paragraph
    const paragraphs = commentary.split(/\n\n+/)
    const meaningfulPara = paragraphs.find(
      (p) =>
        p.includes('Paragrafen') || p.includes('paragrafen') || p.length > 100
    )

    if (meaningfulPara) {
      commentary =
        meaningfulPara.substring(0, 500) +
        (meaningfulPara.length > 500 ? '...' : '')
    } else {
      commentary =
        commentary.substring(0, 300) + (commentary.length > 300 ? '...' : '')
    }

    if (commentary.length > 50) {
      commentaries.push({ chapter, section, commentary })
    }
  }

  return commentaries
}

async function main() {
  const year = '2024/25'
  const number = '59'

  console.log('='.repeat(70))
  console.log(`FETCHING PROP. ${year}:${number}`)
  console.log('='.repeat(70))

  // Step 1: Get metadata
  const meta = await getPropMetadata(year, number)
  if (!meta) return

  console.log(`\ndok_id: ${meta.dokId}`)
  console.log(`Title: ${meta.title}`)
  console.log(`URL: ${meta.htmlUrl}`)

  // Step 2: Fetch HTML
  const html = await fetchPropHtml(meta.dokId)
  if (!html) return

  console.log(`\nFetched ${html.length} bytes of HTML`)

  // Step 3: Extract Författningskommentar
  const fkText = extractForfattningskommentar(html)
  if (!fkText) {
    console.log('\nCould not find Författningskommentar section')
    return
  }

  console.log(`\nExtracted Författningskommentar: ${fkText.length} chars`)

  // Step 4: Parse section commentaries
  const commentaries = parseSectionCommentaries(fkText)

  console.log('\n' + '='.repeat(70))
  console.log(`EXTRACTED ${commentaries.length} SECTION COMMENTARIES`)
  console.log('='.repeat(70))

  // Show first 5 commentaries
  for (const c of commentaries.slice(0, 5)) {
    const chapterStr = c.chapter ? `${c.chapter} kap. ` : ''
    console.log(`\n### ${chapterStr}${c.section} §`)
    console.log('-'.repeat(50))
    console.log(c.commentary)
  }

  if (commentaries.length > 5) {
    console.log(
      `\n... and ${commentaries.length - 5} more section commentaries`
    )
  }

  // Show what we'd store
  console.log('\n' + '='.repeat(70))
  console.log('DATA STRUCTURE FOR STORAGE')
  console.log('='.repeat(70))
  console.log(
    JSON.stringify(
      {
        propRef: `Prop. ${year}:${number}`,
        dokId: meta.dokId,
        title: meta.title,
        sectionCommentaries: commentaries.slice(0, 3),
      },
      null,
      2
    )
  )
}

main().catch(console.error)
