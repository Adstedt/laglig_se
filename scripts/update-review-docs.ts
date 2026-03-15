#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Update the 5 review documents in DB with normalized HTML + linkification + derived content
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { PrismaClient, ContentType } from '@prisma/client'
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
  console.log('Building slug map for linkification...')
  const slugMap = await buildSlugMap()
  console.log(`  Slug map: ${slugMap.size} entries\n`)

  // The 5 review documents
  const targets = [
    { docNum: 'SFS 1977:1160', needsNormalize: true },
    { docNum: 'SFS SFS:2025-18', needsNormalize: false }, // amendment, already canonical
    { docNum: 'AFS 2023:1', needsNormalize: false }, // AFS, already canonical
    { docNum: '32016R0679', needsNormalize: false }, // EU GDPR, already canonical
    { docNum: 'MSBFS 2009:1', needsNormalize: false }, // flat, already canonical
  ]

  for (const t of targets) {
    const doc = await prisma.legalDocument.findFirst({
      where: { document_number: t.docNum },
      select: {
        id: true,
        document_number: true,
        title: true,
        html_content: true,
        content_type: true,
      },
    })

    if (!doc?.html_content) {
      console.log(`✗ ${t.docNum} — not found or no html_content`)
      continue
    }

    console.log(`${doc.document_number} — ${doc.title}`)

    // Phase A: Normalize (only SFS laws need this)
    let canonicalHtml: string
    if (t.needsNormalize && doc.content_type === ContentType.SFS_LAW) {
      canonicalHtml = normalizeSfsLaw(doc.html_content, {
        documentNumber: doc.document_number,
        title: doc.title,
      })
      console.log(
        `  Normalized: ${doc.html_content.length} → ${canonicalHtml.length} chars`
      )
    } else {
      canonicalHtml = doc.html_content
      console.log(`  Already canonical: ${canonicalHtml.length} chars`)
    }

    // Fix legacy class="sfs" → class="legal-document" if needed
    if (
      canonicalHtml.includes('class="sfs"') &&
      !canonicalHtml.includes('class="legal-document"')
    ) {
      canonicalHtml = canonicalHtml.replace(
        /class="sfs"/g,
        'class="legal-document"'
      )
      console.log(`  Fixed class: "sfs" → "legal-document"`)
    }

    // Derive from unlinkified HTML
    const jsonContent = parseCanonicalHtml(canonicalHtml)
    const validation = validateCanonicalJson(jsonContent)
    const markdownContent = htmlToMarkdown(canonicalHtml)
    const fullText = htmlToPlainText(canonicalHtml)

    // Linkify
    const { html: linkifiedHtml } = linkifyHtmlContent(
      canonicalHtml,
      slugMap,
      doc.document_number
    )

    console.log(`  JSON valid: ${validation.valid}`)
    if (!validation.valid) {
      console.log(`  Errors: ${validation.errors.slice(0, 3).join(', ')}`)
    }
    console.log(`  Linkified HTML: ${linkifiedHtml.length} chars`)
    console.log(
      `  Chapters: ${jsonContent.chapters.length}, Divisions: ${jsonContent.divisions?.length ?? 'null'}`
    )

    // Update DB
    await prisma.legalDocument.update({
      where: { id: doc.id },
      data: {
        html_content: linkifiedHtml,
        json_content: jsonContent as unknown as Record<string, unknown>,
        markdown_content: markdownContent,
        full_text: fullText,
      },
    })

    console.log(`  ✓ Updated\n`)
  }

  console.log('Done.')
}

main()
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
