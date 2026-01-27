import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

interface Footnote {
  id: string
  content: string
  legislativeRefs?: Array<{ type: string; reference: string }>
}

interface JsonContent {
  footnotes?: Footnote[]
}

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null },
    },
    select: {
      document_number: true,
      json_content: true,
    },
  })

  const allFootnotes: Array<{
    doc: string
    content: string
    hasLegRef: boolean
  }> = []

  for (const doc of docs) {
    const json = doc.json_content as JsonContent | null
    for (const fn of json?.footnotes || []) {
      allFootnotes.push({
        doc: doc.document_number,
        content: fn.content,
        hasLegRef: (fn.legislativeRefs?.length || 0) > 0,
      })
    }
  }

  // Categorize footnotes by content type
  const categories = {
    legislativeRefs: [] as string[], // prop/bet/rskr
    senasteLydelse: [] as string[], // "Senaste lydelse..."
    forordningOmtryckt: [] as string[], // "Förordningen omtryckt..."
    jfrDirectiv: [] as string[], // "Jfr direktiv/rådets..."
    other: [] as string[],
  }

  for (const fn of allFootnotes) {
    const c = fn.content.toLowerCase()
    if (fn.hasLegRef) {
      categories.legislativeRefs.push(fn.content)
    } else if (c.includes('senaste lydelse')) {
      categories.senasteLydelse.push(fn.content)
    } else if (c.includes('omtryckt') || c.includes('omtryck')) {
      categories.forordningOmtryckt.push(fn.content)
    } else if (
      c.includes('jfr') ||
      c.includes('direktiv') ||
      c.includes('rådets')
    ) {
      categories.jfrDirectiv.push(fn.content)
    } else {
      categories.other.push(fn.content)
    }
  }

  console.log('=== FOOTNOTE CONTENT ANALYSIS ===\n')
  console.log(`Total footnotes: ${allFootnotes.length}\n`)

  console.log(
    `1. Legislative refs (prop/bet/rskr): ${categories.legislativeRefs.length}`
  )
  categories.legislativeRefs
    .slice(0, 3)
    .forEach((c) => console.log(`   "${c.substring(0, 80)}..."`))

  console.log(
    `\n2. "Senaste lydelse" (previous version refs): ${categories.senasteLydelse.length}`
  )
  categories.senasteLydelse
    .slice(0, 3)
    .forEach((c) => console.log(`   "${c.substring(0, 80)}..."`))

  console.log(
    `\n3. "Omtryckt" (reprinted notices): ${categories.forordningOmtryckt.length}`
  )
  categories.forordningOmtryckt
    .slice(0, 3)
    .forEach((c) => console.log(`   "${c.substring(0, 80)}..."`))

  console.log(
    `\n4. EU directive refs (Jfr direktiv): ${categories.jfrDirectiv.length}`
  )
  categories.jfrDirectiv
    .slice(0, 3)
    .forEach((c) => console.log(`   "${c.substring(0, 80)}..."`))

  console.log(`\n5. Other: ${categories.other.length}`)
  categories.other
    .slice(0, 5)
    .forEach((c) => console.log(`   "${c.substring(0, 100)}"`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
