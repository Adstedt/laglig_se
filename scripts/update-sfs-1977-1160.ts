#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Update SFS 1977:1160 with normalized HTML + derived JSON/markdown
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { PrismaClient } from '@prisma/client'
import { normalizeSfsLaw } from '../lib/transforms/normalizers/sfs-law-normalizer'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { validateCanonicalJson } from '../lib/transforms/validate-document-json'
import {
  htmlToMarkdown,
  htmlToPlainText,
} from '../lib/transforms/html-to-markdown'

const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: {
      id: true,
      document_number: true,
      title: true,
      html_content: true,
    },
  })

  if (!doc?.html_content) {
    console.log('Document not found or has no html_content')
    return
  }

  console.log(`Found: ${doc.document_number} — ${doc.title}`)
  console.log(`  Original HTML: ${doc.html_content.length} chars`)

  // Phase A: Normalize
  const normalizedHtml = normalizeSfsLaw(doc.html_content, {
    documentNumber: doc.document_number,
    title: doc.title,
  })
  console.log(`  Normalized HTML: ${normalizedHtml.length} chars`)

  // Phase B: Derive
  const jsonContent = parseCanonicalHtml(normalizedHtml)
  const validation = validateCanonicalJson(jsonContent)
  const markdownContent = htmlToMarkdown(normalizedHtml)
  const fullText = htmlToPlainText(normalizedHtml)

  console.log(`  JSON valid: ${validation.valid}`)
  if (!validation.valid) {
    console.log(`  Errors: ${validation.errors.join(', ')}`)
  }
  console.log(`  JSON: ${JSON.stringify(jsonContent).length} chars`)
  console.log(`  Markdown: ${markdownContent.length} chars`)
  console.log(`  Full text: ${fullText.length} chars`)
  console.log(`  Chapters: ${jsonContent.chapters.length}`)

  // Update
  await prisma.legalDocument.update({
    where: { id: doc.id },
    data: {
      html_content: normalizedHtml,
      json_content: jsonContent as unknown as Record<string, unknown>,
      markdown_content: markdownContent,
      full_text: fullText,
    },
  })

  console.log('\n  ✓ Database updated successfully')
}

main()
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
