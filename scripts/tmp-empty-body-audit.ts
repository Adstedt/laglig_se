/**
 * Audit SFS laws with empty or near-empty body content.
 * Categorize by type (upphävande, tillkännagivande, etc.)
 * Check what metadata the API provides for these.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function getBodyContent(html: string): string {
  // Extract content between <div class="body"> and its closing </div>
  const bodyStart = html.indexOf('<div class="body">')
  if (bodyStart === -1) return html
  const contentStart = bodyStart + '<div class="body">'.length
  // Find matching closing div
  const bodyEnd = html.lastIndexOf('</div>\n</article>')
  if (bodyEnd === -1) return html.substring(contentStart)
  return html.substring(contentStart, bodyEnd).trim()
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  console.log('Fetching all SFS_LAW docs...\n')

  const docs = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_LAW' },
    select: {
      document_number: true,
      title: true,
      html_content: true,
      source_url: true,
    },
  })

  // Categorize by body content size
  const empty: typeof docs = [] // no body text at all
  const tiny: typeof docs = [] // < 100 chars of text in body
  const small: typeof docs = [] // < 300 chars of text in body
  const normal: typeof docs = [] // >= 300 chars
  const noHtml: typeof docs = [] // null html_content

  for (const doc of docs) {
    if (!doc.html_content) {
      noHtml.push(doc)
      continue
    }

    const body = getBodyContent(doc.html_content)
    const textLen = stripTags(body).length

    if (textLen === 0) empty.push(doc)
    else if (textLen < 100) tiny.push(doc)
    else if (textLen < 300) small.push(doc)
    else normal.push(doc)
  }

  console.log('='.repeat(70))
  console.log('BODY CONTENT SIZE DISTRIBUTION')
  console.log('='.repeat(70))
  console.log(`No HTML at all:        ${noHtml.length}`)
  console.log(`Empty body (0 chars):  ${empty.length}`)
  console.log(`Tiny body (<100):      ${tiny.length}`)
  console.log(`Small body (<300):     ${small.length}`)
  console.log(`Normal body (>=300):   ${normal.length}`)
  console.log(`Total:                 ${docs.length}`)

  // Now categorize the empty+tiny+small by title patterns
  const problematic = [...noHtml, ...empty, ...tiny, ...small]

  const titlePatterns: Record<string, typeof docs> = {
    upphävande: [],
    tillkännagivande: [],
    kungörelse: [],
    förordning: [],
    lag: [],
    other: [],
  }

  for (const doc of problematic) {
    const t = (doc.title || '').toLowerCase()
    if (t.includes('upphävande') || t.includes('upphäva')) {
      titlePatterns['upphävande'].push(doc)
    } else if (t.includes('tillkännagivande')) {
      titlePatterns['tillkännagivande'].push(doc)
    } else if (t.includes('kungörelse')) {
      titlePatterns['kungörelse'].push(doc)
    } else if (t.includes('förordning')) {
      titlePatterns['förordning'].push(doc)
    } else if (t.includes('lag ') || t.startsWith('lag(')) {
      titlePatterns['lag'].push(doc)
    } else {
      titlePatterns['other'].push(doc)
    }
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log(`PROBLEMATIC DOCS BY TITLE TYPE (${problematic.length} total)`)
  console.log('='.repeat(70))
  for (const [pattern, pdocs] of Object.entries(titlePatterns).sort(
    (a, b) => b[1].length - a[1].length
  )) {
    if (pdocs.length === 0) continue
    console.log(`\n  ${pattern}: ${pdocs.length} docs`)
    for (const d of pdocs.slice(0, 5)) {
      const body = d.html_content
        ? stripTags(getBodyContent(d.html_content))
        : '(no html)'
      const bodyPreview = body.substring(0, 80) || '(empty)'
      console.log(
        `    ${d.document_number}: "${(d.title || '').substring(0, 55)}"`
      )
      console.log(`      Body: ${bodyPreview}`)
    }
    if (pdocs.length > 5) console.log(`    ... +${pdocs.length - 5} more`)
  }

  // Check the empty ones more carefully - what does the raw API provide?
  console.log(`\n${'='.repeat(70)}`)
  console.log('EMPTY BODY DOCS — DETAILED BREAKDOWN')
  console.log('='.repeat(70))

  // Sub-categorize empty docs
  let emptyWithTitle = 0
  let emptyUpphavande = 0
  let emptyTillkanna = 0
  let emptyN_prefix = 0

  for (const doc of empty) {
    if (doc.title) emptyWithTitle++
    const t = (doc.title || '').toLowerCase()
    if (t.includes('upphävande') || t.includes('upphäva')) emptyUpphavande++
    if (t.includes('tillkännagivande')) emptyTillkanna++
    if (doc.document_number.includes(' N')) emptyN_prefix++
  }

  console.log(`Empty body docs: ${empty.length}`)
  console.log(`  With title:          ${emptyWithTitle}`)
  console.log(`  Upphävande:          ${emptyUpphavande}`)
  console.log(`  Tillkännagivande:    ${emptyTillkanna}`)
  console.log(`  N-prefix doc number: ${emptyN_prefix}`)

  // Show all empty body doc numbers
  if (empty.length <= 50) {
    console.log(`\nAll empty body docs:`)
    for (const d of empty) {
      console.log(`  ${d.document_number}: ${(d.title || '').substring(0, 70)}`)
    }
  }

  // Tiny body - what content do they have?
  console.log(`\n${'='.repeat(70)}`)
  console.log(`TINY BODY DOCS (<100 chars text) — ${tiny.length} docs`)
  console.log('='.repeat(70))
  for (const d of tiny.slice(0, 20)) {
    const body = d.html_content ? stripTags(getBodyContent(d.html_content)) : ''
    console.log(
      `  ${d.document_number} (${body.length} chars): "${body.substring(0, 90)}"`
    )
  }
  if (tiny.length > 20) console.log(`  ... +${tiny.length - 20} more`)

  // Check what metadata we store for empty docs
  console.log(`\n${'='.repeat(70)}`)
  console.log('SAMPLE: What metadata do we have for empty docs?')
  console.log('='.repeat(70))
  for (const d of empty.slice(0, 5)) {
    const full = await prisma.legalDocument.findFirst({
      where: { document_number: d.document_number },
      select: {
        document_number: true,
        title: true,
        effective_date: true,
        issuing_body: true,
        metadata: true,
        source_url: true,
      },
    })
    console.log(`\n  ${full?.document_number}:`)
    console.log(`    title: ${full?.title}`)
    console.log(`    effective_date: ${full?.effective_date}`)
    console.log(`    issuing_body: ${full?.issuing_body}`)
    console.log(`    source_url: ${full?.source_url}`)
    console.log(`    metadata: ${JSON.stringify(full?.metadata)}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
