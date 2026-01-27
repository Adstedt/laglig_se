import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

interface JsonContent {
  type?: string
  title?: string
  metadata?: Record<string, unknown>
  sections?: unknown[]
  footnotes?: Array<{
    id?: string
    number?: string
    text?: string
    content?: string
  }>
  definitions?: unknown[]
  transitionProvisions?: unknown[]
}

async function main() {
  // Get 10 amendments with html_content
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: null },
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
      markdown_content: true,
      json_content: true,
    },
    take: 10,
    orderBy: { document_number: 'asc' },
  })

  console.log(`\nReviewing ${docs.length} amendments with html_content...\n`)

  const summary = {
    totalDocs: docs.length,
    withProp: 0,
    withBet: 0,
    withRskr: 0,
    withFootnotes: 0,
    allRefs: [] as string[],
  }

  for (const doc of docs) {
    console.log('='.repeat(80))
    console.log('Document:', doc.document_number)
    console.log('Title:', doc.title?.substring(0, 70))

    const json = doc.json_content as JsonContent | null
    const html = doc.html_content || ''

    // Check footnotes in JSON
    const footnotes = json?.footnotes || []
    console.log('\nFootnotes count:', footnotes.length)

    if (footnotes.length > 0) {
      summary.withFootnotes++
      console.log('Footnotes content:')
      for (const fn of footnotes) {
        const text = fn.text || fn.content || ''
        console.log(
          `  [${fn.number || fn.id}]: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`
        )

        // Extract references from footnotes
        const propMatch = text.match(/[Pp]rop\.\s*\d{4}\/\d{2,4}:\d+/g)
        const betMatch = text.match(/[Bb]et\.\s*\d{4}\/\d{2,4}:[A-Za-z]+\d+/g)
        const rskrMatch = text.match(/[Rr]skr\.\s*\d{4}\/\d{2,4}:\d+/g)

        if (propMatch) {
          summary.withProp++
          summary.allRefs.push(...propMatch)
          console.log(`    -> Found prop: ${propMatch.join(', ')}`)
        }
        if (betMatch) {
          summary.withBet++
          summary.allRefs.push(...betMatch)
          console.log(`    -> Found bet: ${betMatch.join(', ')}`)
        }
        if (rskrMatch) {
          summary.withRskr++
          summary.allRefs.push(...rskrMatch)
          console.log(`    -> Found rskr: ${rskrMatch.join(', ')}`)
        }
      }
    }

    // Also check HTML for footnote sections
    const footnoteSection = html.match(
      /<div[^>]*class="[^"]*footnote[^"]*"[^>]*>[\s\S]*?<\/div>/gi
    )
    if (footnoteSection) {
      console.log('\nFootnote HTML sections found:', footnoteSection.length)
      for (const section of footnoteSection.slice(0, 2)) {
        const text = section
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        console.log(`  HTML footnote: ${text.substring(0, 120)}...`)
      }
    }

    // Check HTML structure quality
    console.log('\nHTML structure:')
    const hasSections = (html.match(/<section/g) || []).length
    const hasDl = (html.match(/<dl/g) || []).length
    console.log(`  Sections: ${hasSections}, Definition lists: ${hasDl}`)
    console.log('')
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total documents reviewed: ${summary.totalDocs}`)
  console.log(`Documents with footnotes: ${summary.withFootnotes}`)
  console.log(`Documents with prop refs: ${summary.withProp}`)
  console.log(`Documents with bet refs: ${summary.withBet}`)
  console.log(`Documents with rskr refs: ${summary.withRskr}`)
  console.log(`\nAll unique references found:`)
  const uniqueRefs = [...new Set(summary.allRefs)]
  uniqueRefs.forEach((ref) => console.log(`  ${ref}`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
