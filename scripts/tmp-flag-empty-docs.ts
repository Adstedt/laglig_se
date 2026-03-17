/**
 * Flag SFS_LAW docs with empty/stub body content.
 * Adds metadata.contentAvailability:
 *   - "external" — body text at rkrattsbaser.gov.se (N-prefix, upphävande)
 *   - "print_only" — "Författningens text finns bara i tryckt version"
 *   - "metadata_only" — only title/metadata, no body text and no known external source
 *
 * Also stores metadata.externalUrl when available.
 *
 * DRY RUN by default. Pass --apply to write to DB.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const DRY_RUN = !process.argv.includes('--apply')

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getBodyText(html: string): string {
  const bodyStart = html.indexOf('<div class="body">')
  if (bodyStart === -1) return stripTags(html)
  const contentStart = bodyStart + '<div class="body">'.length
  const bodyEnd = html.lastIndexOf('</div>\n</article>')
  if (bodyEnd === -1) return stripTags(html.substring(contentStart))
  return stripTags(html.substring(contentStart, bodyEnd))
}

type Availability = 'external' | 'print_only' | 'metadata_only'

function classify(doc: {
  document_number: string
  title: string | null
  html_content: string | null
}): { availability: Availability; externalUrl: string | null } | null {
  if (!doc.html_content) {
    return { availability: 'metadata_only', externalUrl: null }
  }

  const bodyText = getBodyText(doc.html_content)

  // Check for "print only" marker
  if (bodyText.includes('Författningens text finns bara i tryckt version')) {
    return { availability: 'print_only', externalUrl: null }
  }

  // Empty or near-empty body (< 5 chars of actual text)
  if (bodyText.length < 5) {
    const sfsNum = doc.document_number.replace('SFS ', '')
    const externalUrl = `http://rkrattsbaser.gov.se/sfst?bet=${encodeURIComponent(sfsNum)}`
    return { availability: 'external', externalUrl }
  }

  return null // Normal doc, no flag needed
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLYING TO DB'}\n`)

  const docs = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_LAW' },
    select: {
      id: true,
      document_number: true,
      title: true,
      html_content: true,
      metadata: true,
    },
  })

  const counts = { external: 0, print_only: 0, metadata_only: 0, normal: 0 }
  const flagged: Array<{
    id: string
    docNum: string
    availability: Availability
    externalUrl: string | null
  }> = []

  for (const doc of docs) {
    const result = classify(doc)
    if (!result) {
      counts.normal++
      continue
    }

    counts[result.availability]++
    flagged.push({
      id: doc.id,
      docNum: doc.document_number,
      availability: result.availability,
      externalUrl: result.externalUrl,
    })
  }

  console.log('Classification results:')
  console.log(`  Normal (has body):   ${counts.normal}`)
  console.log(`  External source:     ${counts.external}`)
  console.log(`  Print only:          ${counts.print_only}`)
  console.log(`  Metadata only:       ${counts.metadata_only}`)
  console.log(`  Total to flag:       ${flagged.length}`)

  // Show breakdown
  console.log('\nSamples by category:')
  for (const cat of [
    'external',
    'print_only',
    'metadata_only',
  ] as Availability[]) {
    const catDocs = flagged.filter((f) => f.availability === cat)
    console.log(`\n  --- ${cat} (${catDocs.length}) ---`)
    for (const d of catDocs.slice(0, 5)) {
      console.log(
        `    ${d.docNum}${d.externalUrl ? ' → ' + d.externalUrl : ''}`
      )
    }
    if (catDocs.length > 5) console.log(`    ... +${catDocs.length - 5} more`)
  }

  if (!DRY_RUN) {
    console.log('\nApplying flags to DB...')
    let updated = 0
    for (const f of flagged) {
      const doc = docs.find((d) => d.id === f.id)
      const existingMeta = (doc?.metadata as Record<string, unknown>) || {}

      const newMeta: Record<string, unknown> = {
        ...existingMeta,
        contentAvailability: f.availability,
      }
      if (f.externalUrl) {
        newMeta.externalUrl = f.externalUrl
      }

      await prisma.legalDocument.update({
        where: { id: f.id },
        data: { metadata: newMeta },
      })
      updated++
      if (updated % 50 === 0)
        console.log(`  Updated ${updated}/${flagged.length}`)
    }
    console.log(`Done. Updated ${updated} documents.`)
  } else {
    console.log('\nDry run complete. Run with --apply to update DB.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
