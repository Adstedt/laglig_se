/**
 * Validate ALL SFS_LAW docs by running them through the canonical JSON parser.
 * If the parser extracts structure correctly, the HTML is provably canonical.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { validateCanonicalJson } from '../lib/transforms/validate-document-json'

const prisma = new PrismaClient()

interface ValidationResult {
  docNum: string
  size: number
  parseOk: boolean
  validationOk: boolean
  chapters: number
  sections: number
  paragraphs: number
  hasDivisions: boolean
  errors: string[]
}

async function main() {
  const batchSize = 500
  let offset = 0
  let totalProcessed = 0

  const summary = {
    total: 0,
    parseOk: 0,
    validationOk: 0,
    parseFailed: 0,
    validationFailed: 0,
    noHtml: 0,
    totalChapters: 0,
    totalSections: 0,
    totalParagraphs: 0,
    withDivisions: 0,
    errors: new Map<string, number>(),
    failedDocs: [] as { docNum: string; error: string }[],
  }

  // Count total
  const totalCount = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  console.log(`Validating ${totalCount} SFS_LAW documents...\n`)

  while (true) {
    const docs = await prisma.legalDocument.findMany({
      where: { content_type: 'SFS_LAW' },
      select: {
        document_number: true,
        html_content: true,
      },
      skip: offset,
      take: batchSize,
      orderBy: { document_number: 'asc' },
    })

    if (docs.length === 0) break

    for (const doc of docs) {
      summary.total++

      if (!doc.html_content) {
        summary.noHtml++
        continue
      }

      try {
        const json = parseCanonicalHtml(doc.html_content)
        summary.parseOk++

        // Count structure
        let chapters = 0
        let sections = 0
        let paragraphs = 0

        if (json.divisions && json.divisions.length > 0) {
          summary.withDivisions++
          for (const div of json.divisions) {
            chapters += div.chapters.length
            for (const ch of div.chapters) {
              sections += ch.sections.length
              for (const sec of ch.sections) {
                paragraphs += sec.paragraphs.length
              }
            }
          }
        } else {
          chapters = json.chapters.length
          for (const ch of json.chapters) {
            sections += ch.sections.length
            for (const sec of ch.sections) {
              paragraphs += sec.paragraphs.length
            }
          }
        }

        summary.totalChapters += chapters
        summary.totalSections += sections
        summary.totalParagraphs += paragraphs

        // Validate with Zod
        const validation = validateCanonicalJson(json)
        if (validation.valid) {
          summary.validationOk++
        } else {
          summary.validationFailed++
          const errKey = validation.errors.join(' | ')
          summary.errors.set(errKey, (summary.errors.get(errKey) || 0) + 1)
          if (summary.failedDocs.length < 20) {
            summary.failedDocs.push({
              docNum: doc.document_number,
              error: errKey,
            })
          }
        }
      } catch (e: any) {
        summary.parseFailed++
        const errMsg = (e.message || '').substring(0, 100)
        summary.errors.set(errMsg, (summary.errors.get(errMsg) || 0) + 1)
        if (summary.failedDocs.length < 20) {
          summary.failedDocs.push({
            docNum: doc.document_number,
            error: errMsg,
          })
        }
      }
    }

    offset += docs.length
    totalProcessed += docs.length

    if (totalProcessed % 2000 === 0 || totalProcessed === totalCount) {
      const pct = ((totalProcessed / totalCount) * 100).toFixed(1)
      console.log(
        `  [${totalProcessed}/${totalCount}] ${pct}% | ` +
          `parseOk=${summary.parseOk} parseFail=${summary.parseFailed} ` +
          `validOk=${summary.validationOk} validFail=${summary.validationFailed}`
      )
    }
  }

  // Final summary
  console.log(`\n${'='.repeat(70)}`)
  console.log('VALIDATION SUMMARY — ALL SFS_LAW DOCUMENTS')
  console.log('='.repeat(70))
  console.log(`Total documents:      ${summary.total}`)
  console.log(`No HTML content:      ${summary.noHtml}`)
  console.log(``)
  console.log(
    `Parse succeeded:      ${summary.parseOk} (${((summary.parseOk / (summary.total - summary.noHtml)) * 100).toFixed(1)}%)`
  )
  console.log(`Parse failed:         ${summary.parseFailed}`)
  console.log(
    `Validation passed:    ${summary.validationOk} (${((summary.validationOk / (summary.total - summary.noHtml)) * 100).toFixed(1)}%)`
  )
  console.log(`Validation failed:    ${summary.validationFailed}`)
  console.log(``)
  console.log(`Total chapters:       ${summary.totalChapters}`)
  console.log(`Total sections (§):   ${summary.totalSections}`)
  console.log(`Total paragraphs:     ${summary.totalParagraphs}`)
  console.log(`Docs with divisions:  ${summary.withDivisions}`)

  if (summary.errors.size > 0) {
    console.log(`\nError breakdown:`)
    const sorted = [...summary.errors.entries()].sort((a, b) => b[1] - a[1])
    for (const [err, count] of sorted.slice(0, 15)) {
      console.log(`  ${count}x: ${err.substring(0, 120)}`)
    }
  }

  if (summary.failedDocs.length > 0) {
    console.log(`\nFailed docs (first 20):`)
    for (const { docNum, error } of summary.failedDocs) {
      console.log(`  ${docNum}: ${error.substring(0, 100)}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
