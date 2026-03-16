/**
 * Comprehensive HTML audit across all Swedish document types.
 * For each content type, check structural conformance to canonical schema.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

interface AuditResult {
  hasWrapper: boolean // <article class="legal-document"
  hasOldWrapper: boolean // <article class="sfs"
  hasLovhead: boolean // div.lovhead
  hasBody: boolean // div.body
  hasParagraph: boolean // h3.paragraph (wrapping a.paragraf)
  hasParagraf: boolean // a.paragraf
  hasText: boolean // p.text
  hasKapitel: boolean // section.kapitel
  hasSectionSign: boolean // contains § character in meaningful context
  hasOldBoldParagraf: boolean // <b>1 §</b> (old Riksdag format)
  hasOldNameAnchor: boolean // <a name="K1P1"> without class="paragraf"
  hasNotisum: boolean // section.ann or div.annzone (old amendment format)
  size: number
}

function audit(html: string): AuditResult {
  return {
    hasWrapper: html.includes('class="legal-document"'),
    hasOldWrapper: html.includes('class="sfs"'),
    hasLovhead: html.includes('class="lovhead"'),
    hasBody: html.includes('class="body"'),
    hasParagraph: html.includes('class="paragraph"'),
    hasParagraf: html.includes('class="paragraf"'),
    hasText: html.includes('class="text"'),
    hasKapitel: html.includes('class="kapitel"'),
    hasSectionSign: /\d+\s*§/.test(html),
    hasOldBoldParagraf: /<b>\d+\s*§<\/b>/.test(html),
    hasOldNameAnchor:
      /<a\s+name="[A-Z]\d/.test(html) && !html.includes('class="paragraf"'),
    hasNotisum:
      html.includes('section class="ann"') || html.includes('class="annzone"'),
    size: html.length,
  }
}

type Category =
  | 'CANONICAL' // Fully conformant
  | 'SIMPLE_CANONICAL' // Has wrapper but no § (legitimately simple)
  | 'OLD_WRAPPER_GOOD' // class="sfs" but inner structure is canonical
  | 'OLD_WRAPPER_SIMPLE' // class="sfs", no §, simple doc
  | 'PARTIAL' // Has wrapper but old inner structure
  | 'NOTISUM' // Old Notisum amendment format
  | 'RAW' // No wrapper at all
  | 'EMPTY' // No html_content

function categorize(r: AuditResult | null): Category {
  if (!r) return 'EMPTY'

  if (r.hasWrapper) {
    if (r.hasParagraph && r.hasParagraf && r.hasText) return 'CANONICAL'
    if (!r.hasSectionSign) return 'SIMPLE_CANONICAL'
    return 'PARTIAL'
  }

  if (r.hasOldWrapper) {
    if (r.hasNotisum) return 'NOTISUM'
    if (r.hasParagraph && r.hasParagraf && r.hasText) return 'OLD_WRAPPER_GOOD'
    if (!r.hasSectionSign) return 'OLD_WRAPPER_SIMPLE'
    return 'PARTIAL'
  }

  if (r.hasNotisum) return 'NOTISUM'
  return 'RAW'
}

async function auditContentType(contentType: string) {
  const docs = await prisma.legalDocument.findMany({
    where: { content_type: contentType as any },
    select: {
      id: true,
      document_number: true,
      html_content: true,
      metadata: true,
    },
  })

  const categories = new Map<Category, number>()
  const categoryExamples = new Map<Category, string[]>()
  let totalSize = 0

  for (const doc of docs) {
    const r = doc.html_content ? audit(doc.html_content) : null
    const cat = categorize(r)
    categories.set(cat, (categories.get(cat) || 0) + 1)

    if (!categoryExamples.has(cat)) categoryExamples.set(cat, [])
    const examples = categoryExamples.get(cat)!
    if (examples.length < 3) examples.push(doc.document_number)

    if (r) totalSize += r.size
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log(
    `${contentType} (${docs.length} docs, ${(totalSize / 1024 / 1024).toFixed(1)} MB)`
  )
  console.log('='.repeat(70))

  const order: Category[] = [
    'CANONICAL',
    'SIMPLE_CANONICAL',
    'OLD_WRAPPER_GOOD',
    'OLD_WRAPPER_SIMPLE',
    'PARTIAL',
    'NOTISUM',
    'RAW',
    'EMPTY',
  ]
  for (const cat of order) {
    const count = categories.get(cat)
    if (!count) continue
    const pct = ((count / docs.length) * 100).toFixed(1)
    const examples = categoryExamples.get(cat) || []
    console.log(
      `  ${cat.padEnd(22)} ${String(count).padStart(6)} (${pct.padStart(5)}%)  e.g. ${examples.join(', ')}`
    )
  }

  // Action summary
  const canonical =
    (categories.get('CANONICAL') || 0) +
    (categories.get('SIMPLE_CANONICAL') || 0)
  const needsWrapperFix =
    (categories.get('OLD_WRAPPER_GOOD') || 0) +
    (categories.get('OLD_WRAPPER_SIMPLE') || 0)
  const needsReIngest =
    (categories.get('NOTISUM') || 0) + (categories.get('RAW') || 0)
  const needsFix = categories.get('PARTIAL') || 0
  const empty = categories.get('EMPTY') || 0

  console.log(`  ---`)
  console.log(`  OK (no action):      ${canonical}`)
  console.log(`  Wrapper rename:      ${needsWrapperFix}`)
  console.log(`  Needs fix/patch:     ${needsFix}`)
  console.log(`  Needs re-ingest:     ${needsReIngest}`)
  console.log(`  Empty (no HTML):     ${empty}`)
}

async function main() {
  const types = ['SFS_LAW', 'SFS_AMENDMENT', 'AGENCY_REGULATION']
  for (const ct of types) {
    await auditContentType(ct)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
