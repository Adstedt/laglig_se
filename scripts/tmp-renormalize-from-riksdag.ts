import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

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

const targets = [{ docNum: 'SFS 2026:56', apiSlug: 'sfs-2026-56' }]

async function main() {
  console.log('Building slug map...')
  const slugMap = await buildSlugMap()
  console.log(`Slug map: ${slugMap.size} entries\n`)

  for (const t of targets) {
    const doc = await prisma.legalDocument.findFirst({
      where: { document_number: t.docNum },
      select: { id: true, document_number: true, title: true, slug: true },
    })
    if (!doc) {
      console.log(`${t.docNum} — not found`)
      continue
    }

    const apiUrl = `https://data.riksdagen.se/dokument/${t.apiSlug}.html`
    console.log(`${doc.document_number} — ${doc.title}`)
    console.log(`Slug: ${doc.slug}`)
    console.log(`Fetching from Riksdag...`)
    const res = await fetch(apiUrl)
    const originalHtml = await res.text()
    console.log(`  Original: ${originalHtml.length} chars`)

    const normalized = normalizeSfsLaw(originalHtml, {
      documentNumber: doc.document_number,
      title: doc.title,
    })
    console.log(`  Normalized: ${normalized.length} chars`)

    const hasFooter = normalized.includes('<footer class="back">')
    console.log(`  Has footer: ${hasFooter}`)

    const json = parseCanonicalHtml(normalized)
    const validation = validateCanonicalJson(json)
    const md = htmlToMarkdown(normalized)
    const fullText = htmlToPlainText(normalized)

    console.log(`  JSON valid: ${validation.valid}`)
    if (!validation.valid)
      console.log(`  Errors: ${validation.errors.slice(0, 3).join(', ')}`)
    console.log(
      `  Chapters: ${json.chapters.length}, Sections: ${json.chapters[0]?.sections.length ?? 0}`
    )
    console.log(
      `  Transition provisions: ${json.transitionProvisions?.length ?? 0}`
    )

    const { html: linkified } = linkifyHtmlContent(
      normalized,
      slugMap,
      doc.document_number
    )

    await prisma.legalDocument.update({
      where: { id: doc.id },
      data: {
        html_content: linkified,
        json_content: json as unknown as Record<string, unknown>,
        markdown_content: md,
        full_text: fullText,
      },
    })
    console.log(`  Updated\n`)
  }
  console.log('Done.')
}

main()
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
