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

const targets = ['SFS 2026:56']

async function main() {
  console.log('Building slug map...')
  const slugMap = await buildSlugMap()
  console.log(`Slug map: ${slugMap.size} entries\n`)

  for (const docNum of targets) {
    const doc = await prisma.legalDocument.findFirst({
      where: { document_number: docNum },
      select: {
        id: true,
        document_number: true,
        title: true,
        slug: true,
        html_content: true,
      },
    })
    if (!doc || !doc.html_content) {
      console.log(`${docNum} — not found`)
      continue
    }

    console.log(`${doc.document_number} — ${doc.title}`)

    // Extract the body content from the existing canonical HTML
    // by stripping the <article> wrapper to get back to "raw-ish" content
    const existing = doc.html_content
    const bodyMatch = existing.match(
      /<div class="body">([\s\S]*?)<\/div>\s*(?:<footer|<\/article>)/
    )
    if (!bodyMatch) {
      console.log('  Could not extract body')
      continue
    }

    // Re-wrap as simple HTML for the normalizer (bypass idempotency check)
    const bodyContent = bodyMatch[1]!
    const rawHtml = `<div>${bodyContent}</div>`
    console.log(`  Body content: ${rawHtml.length} chars`)

    const normalized = normalizeSfsLaw(rawHtml, {
      documentNumber: doc.document_number,
      title: doc.title,
    })
    console.log(`  Normalized: ${normalized.length} chars`)

    const json = parseCanonicalHtml(normalized)
    const validation = validateCanonicalJson(json)
    const md = htmlToMarkdown(normalized)
    const fullText = htmlToPlainText(normalized)

    console.log(`  JSON valid: ${validation.valid}`)
    console.log(
      `  Sections: ${json.chapters.flatMap((c) => c.sections).length}`
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
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
