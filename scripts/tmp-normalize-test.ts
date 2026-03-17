import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { normalizeSfsLaw } from '../lib/transforms/normalizers/sfs-law-normalizer'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { validateCanonicalJson } from '../lib/transforms/validate-document-json'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '../lib/transforms/html-to-markdown'
import { linkifyHtmlContent, buildSlugMap } from '../lib/linkify'

const prisma = new PrismaClient()

async function main() {
  // Get doc metadata from DB
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: { contains: '2025:1535' } },
    select: { id: true, document_number: true, title: true },
  })
  if (!doc) {
    console.log('Not found')
    return
  }

  // Re-fetch original HTML from Riksdag API
  console.log('Fetching original from Riksdag API...')
  const apiUrl = 'https://data.riksdagen.se/dokument/sfs-2025-1535.html'
  const res = await fetch(apiUrl)
  const originalHtml = await res.text()
  console.log(`Original: ${originalHtml.length} chars`)

  // Show what's around the overgang area
  const ovIdx = originalHtml.indexOf('overgang')
  if (ovIdx > -1) {
    console.log(`\nOvergang found at char ${ovIdx}`)
    console.log('Context:', originalHtml.substring(ovIdx - 100, ovIdx + 300))
  }

  // Normalize
  console.log('\n--- Normalizing ---')
  const normalized = normalizeSfsLaw(originalHtml, {
    documentNumber: doc.document_number,
    title: doc.title,
  })
  console.log(`Normalized: ${originalHtml.length} → ${normalized.length} chars`)

  // Check footer
  const footerIdx = normalized.indexOf('<footer')
  if (footerIdx > -1) {
    console.log(`\nFooter found at char ${footerIdx}`)
    console.log(normalized.substring(footerIdx))
  } else {
    console.log('\nNO FOOTER FOUND')
    console.log(
      'Last 500 chars:',
      normalized.substring(normalized.length - 500)
    )
  }

  // Derive
  const json = parseCanonicalHtml(normalized)
  const validation = validateCanonicalJson(json)
  const md = htmlToMarkdown(normalized)
  const fullText = htmlToPlainText(normalized)

  console.log(`\nJSON valid: ${validation.valid}`)
  console.log(
    `Chapters: ${json.chapters.length}, Sections: ${json.chapters[0]?.sections.length ?? 0}`
  )
  console.log(`Transition provisions: ${json.transitionProvisions ?? 'null'}`)

  // Linkify
  console.log('\nBuilding slug map...')
  const slugMap = await buildSlugMap()
  const { html: linkified } = linkifyHtmlContent(
    normalized,
    slugMap,
    doc.document_number
  )

  // Update DB
  await prisma.legalDocument.update({
    where: { id: doc.id },
    data: {
      html_content: linkified,
      json_content: json as unknown as Record<string, unknown>,
      markdown_content: md,
      full_text: fullText,
    },
  })
  console.log('Updated in DB')
}

main()
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
