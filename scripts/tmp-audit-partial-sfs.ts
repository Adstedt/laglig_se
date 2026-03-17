/**
 * Deep-dive into the 755 PARTIAL SFS laws.
 * What exactly is wrong with each one?
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
      html_content: { not: null },
    },
    select: {
      document_number: true,
      html_content: true,
      title: true,
    },
  })

  // Find PARTIAL: has wrapper + has § + missing at least one canonical marker
  const partial: Array<{
    docNum: string
    title: string
    size: number
    hasWrapper: boolean
    hasParagraph: boolean
    hasParagraf: boolean
    hasText: boolean
    hasKapitel: boolean
    hasOldBold: boolean
    hasOldAnchor: boolean
    pattern: string
  }> = []

  for (const doc of docs) {
    const h = doc.html_content!
    const hasWrapper = h.includes('class="legal-document"')
    const hasSectionSign = /\d+\s*§/.test(h)
    const hasParagraph = h.includes('class="paragraph"')
    const hasParagraf = h.includes('class="paragraf"')
    const hasText = h.includes('class="text"')

    if (
      hasWrapper &&
      hasSectionSign &&
      !(hasParagraph && hasParagraf && hasText)
    ) {
      const hasKapitel = h.includes('class="kapitel"')
      const hasOldBold = /<b>\d+\s*§<\/b>/.test(h)
      const hasOldAnchor = /<a\s+name="[A-Z]\d/.test(h)

      // Classify the sub-pattern
      let pattern = ''
      if (hasParagraf && !hasParagraph && !hasText)
        pattern = 'has-paragraf-only'
      else if (hasParagraf && hasParagraph && !hasText)
        pattern = 'missing-text-class'
      else if (hasParagraf && !hasParagraph && hasText)
        pattern = 'missing-paragraph-class'
      else if (!hasParagraf && !hasParagraph && hasText)
        pattern = 'has-text-only'
      else if (!hasParagraf && !hasParagraph && !hasText)
        pattern = 'none-of-three'
      else pattern = `p=${hasParagraph} f=${hasParagraf} t=${hasText}`

      // Check if § appears only in cross-references (not as structural heading)
      const structuralParagraf = h.match(
        /<a[^>]*class="paragraf"[^>]*>\d+\s*§<\/a>/g
      )
      const sectionSignInText = h.match(/\d+\s*§/g)
      if (!structuralParagraf && sectionSignInText) {
        pattern += ' (§-in-text-only)'
      }

      partial.push({
        docNum: doc.document_number,
        title: (doc.title || '').substring(0, 50),
        size: h.length,
        hasWrapper,
        hasParagraph,
        hasParagraf,
        hasText,
        hasKapitel,
        hasOldBold,
        hasOldAnchor,
        pattern,
      })
    }
  }

  console.log(`PARTIAL SFS_LAW docs: ${partial.length}\n`)

  // Group by pattern
  const byPattern = new Map<string, typeof partial>()
  for (const p of partial) {
    const key = p.pattern
    if (!byPattern.has(key)) byPattern.set(key, [])
    byPattern.get(key)!.push(p)
  }

  for (const [pattern, docs] of [...byPattern.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )) {
    console.log(`\n--- ${pattern}: ${docs.length} docs ---`)
    for (const d of docs.slice(0, 5)) {
      console.log(
        `  ${d.docNum} (${(d.size / 1024).toFixed(1)} KB) "${d.title}" kapitel=${d.hasKapitel} oldBold=${d.hasOldBold} oldAnchor=${d.hasOldAnchor}`
      )
    }
    if (docs.length > 5) console.log(`  ... and ${docs.length - 5} more`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
