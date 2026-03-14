/**
 * Test the conformance prompt against 5 docs from each content type.
 * Sends to Haiku, validates output, saves results for review.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, mkdirSync } from 'fs'
import {
  CONFORMANCE_SYSTEM_PROMPT,
  buildConformanceUserMessage,
  generateDocId,
} from '../lib/transforms/conformance-prompt'

const prisma = new PrismaClient()
const anthropic = new Anthropic()

const CONTENT_TYPES = [
  'SFS_LAW',
  'SFS_AMENDMENT',
  'AGENCY_REGULATION',
  'EU_REGULATION',
  'EU_DIRECTIVE',
]

// Pick docs of varying sizes: 1 small, 2 medium, 1 large, 1 that might be tricky
async function pickDocs(contentType: string, count: number) {
  // Get size distribution first
  const stats = await prisma.$queryRawUnsafe<
    [{ min_len: bigint; max_len: bigint; p50: bigint }]
  >(
    `SELECT MIN(LENGTH(html_content)) as min_len, MAX(LENGTH(html_content)) as max_len,
     PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY LENGTH(html_content)) as p50
     FROM legal_documents WHERE content_type = $1::"ContentType" AND html_content IS NOT NULL`,
    contentType
  )

  const maxLen = Number(stats[0]?.max_len || 0)

  // Cap at 200KB to stay within context window (Haiku ~200K tokens)
  const sizeLimit = Math.min(maxLen, 200_000)

  // Pick a spread: smallest, 25th pct, median, 75th pct, largest-within-limit
  const docs = await prisma.$queryRawUnsafe<any[]>(
    `WITH ranked AS (
       SELECT id, document_number, title, content_type,
         LENGTH(html_content) as html_len,
         NTILE(4) OVER (ORDER BY LENGTH(html_content)) as quartile
       FROM legal_documents
       WHERE content_type = $1::"ContentType"
         AND html_content IS NOT NULL
         AND LENGTH(html_content) > 100
         AND LENGTH(html_content) <= $2
     )
     (SELECT * FROM ranked WHERE quartile = 1 ORDER BY RANDOM() LIMIT 1)
     UNION ALL
     (SELECT * FROM ranked WHERE quartile = 2 ORDER BY RANDOM() LIMIT 1)
     UNION ALL
     (SELECT * FROM ranked WHERE quartile = 3 ORDER BY RANDOM() LIMIT 2)
     UNION ALL
     (SELECT * FROM ranked WHERE quartile = 4 ORDER BY RANDOM() LIMIT 1)`,
    contentType,
    sizeLimit
  )

  return docs.slice(0, count)
}

interface TestResult {
  contentType: string
  documentNumber: string
  title: string
  inputSize: number
  outputSize: number
  inputTokens: number
  outputTokens: number
  cost: number
  duration: number
  validation: {
    hasArticleWrapper: boolean
    hasLovhead: boolean
    hasBody: boolean
    hasParagraphClass: boolean
    hasParagrafClass: boolean
    hasTextClass: boolean
    hasOldBoldParagraf: boolean
    hasOldAnchorFormat: boolean
    valid: boolean
    issues: string[]
  }
}

function validateOutput(html: string, docId: string): TestResult['validation'] {
  const issues: string[] = []

  const hasArticleWrapper = html.includes(
    `<article class="legal-document" id="${docId}"`
  )
  const hasLovhead = html.includes('class="lovhead"')
  const hasBody = html.includes('class="body"')
  const hasParas = html.includes('§') || html.includes('Artikel')
  const hasParagraphClass = html.includes('class="paragraph"')
  const hasParagrafClass = html.includes('class="paragraf"')
  const hasTextClass = html.includes('class="text"')
  const hasOldBoldParagraf = html.includes('<b>') && html.includes('§</b>')
  const hasOldAnchorFormat =
    /name="[A-Z]\d+"/.test(html) && !html.includes('class="paragraf"')

  if (!hasArticleWrapper)
    issues.push('Missing article.legal-document wrapper with correct DOC_ID')
  if (!hasLovhead) issues.push('Missing div.lovhead')
  if (!hasBody) issues.push('Missing div.body')
  if (hasParas && !hasParagraphClass)
    issues.push('Has § but missing h3.paragraph')
  if (hasParas && !hasParagrafClass) issues.push('Has § but missing a.paragraf')
  if (!hasTextClass) issues.push('Missing p.text')
  if (hasOldBoldParagraf) issues.push('Still has old <b>§</b> format')
  if (hasOldAnchorFormat)
    issues.push('Still has old anchor format without class="paragraf"')

  return {
    hasArticleWrapper,
    hasLovhead,
    hasBody,
    hasParagraphClass,
    hasParagrafClass,
    hasTextClass,
    hasOldBoldParagraf,
    hasOldAnchorFormat,
    valid: issues.length === 0,
    issues,
  }
}

async function processDoc(doc: any): Promise<TestResult> {
  const fullDoc = await prisma.legalDocument.findUnique({
    where: { id: doc.id },
    select: {
      html_content: true,
      document_number: true,
      title: true,
      content_type: true,
    },
  })

  if (!fullDoc?.html_content)
    throw new Error(`No html_content for ${doc.document_number}`)

  const docId = generateDocId(fullDoc.document_number, fullDoc.content_type)
  const userMessage = buildConformanceUserMessage({
    docId,
    documentNumber: fullDoc.document_number,
    title: fullDoc.title,
    contentType: fullDoc.content_type,
    html: fullDoc.html_content,
  })

  const start = Date.now()

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16384,
    system: CONFORMANCE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const duration = Date.now() - start
  const outputHtml =
    response.content[0]?.type === 'text' ? response.content[0].text : ''

  // Strip markdown fences if present
  const cleanOutput = outputHtml
    .replace(/^```html?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()

  const validation = validateOutput(cleanOutput, docId)

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const cost = (inputTokens * 0.8 + outputTokens * 4.0) / 1_000_000

  return {
    contentType: fullDoc.content_type,
    documentNumber: fullDoc.document_number,
    title: fullDoc.title,
    inputSize: fullDoc.html_content.length,
    outputSize: cleanOutput.length,
    inputTokens,
    outputTokens,
    cost,
    duration,
    validation,
  }
}

async function main() {
  const outputDir = resolve(process.cwd(), 'data', 'conformance-test')
  mkdirSync(outputDir, { recursive: true })

  const allResults: TestResult[] = []
  let totalCost = 0

  for (const ct of CONTENT_TYPES) {
    const count = await prisma.legalDocument.count({
      where: { content_type: ct, html_content: { not: null } },
    })

    if (count === 0) {
      console.log(`\n⏭ ${ct}: no documents, skipping`)
      continue
    }

    console.log(`\n${'='.repeat(70)}`)
    console.log(`${ct} (${count} total docs)`)
    console.log('='.repeat(70))

    const docs = await pickDocs(ct, 5)
    console.log(`Selected ${docs.length} docs for testing`)

    for (const doc of docs) {
      const sizeKB = (Number(doc.html_len) / 1024).toFixed(1)
      process.stdout.write(`  ${doc.document_number} (${sizeKB} KB)... `)

      try {
        const result = await processDoc(doc)
        allResults.push(result)
        totalCost += result.cost

        const status = result.validation.valid ? 'PASS' : 'FAIL'
        const issues = result.validation.issues.length
          ? ` [${result.validation.issues.join(', ')}]`
          : ''
        console.log(
          `${status} | ${result.inputTokens}→${result.outputTokens} tok | $${result.cost.toFixed(3)} | ${result.duration}ms${issues}`
        )
      } catch (err: any) {
        console.log(`ERROR: ${err.message?.substring(0, 100)}`)
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`)
  console.log('SUMMARY')
  console.log('='.repeat(70))

  const passed = allResults.filter((r) => r.validation.valid).length
  const failed = allResults.filter((r) => !r.validation.valid).length

  console.log(`Total docs tested: ${allResults.length}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total cost: $${totalCost.toFixed(2)}`)
  console.log(`Avg cost/doc: $${(totalCost / allResults.length).toFixed(3)}`)

  if (failed > 0) {
    console.log('\nFailed docs:')
    for (const r of allResults.filter((r) => !r.validation.valid)) {
      console.log(`  ${r.documentNumber}: ${r.validation.issues.join(', ')}`)
    }
  }

  // Per content-type summary
  console.log('\nPer content type:')
  for (const ct of CONTENT_TYPES) {
    const ctResults = allResults.filter((r) => r.contentType === ct)
    if (ctResults.length === 0) continue
    const ctPassed = ctResults.filter((r) => r.validation.valid).length
    const ctCost = ctResults.reduce((s, r) => s + r.cost, 0)
    console.log(
      `  ${ct.padEnd(22)} ${ctPassed}/${ctResults.length} passed  $${ctCost.toFixed(3)}`
    )
  }

  // Save full results
  writeFileSync(
    resolve(outputDir, 'results.json'),
    JSON.stringify(allResults, null, 2)
  )
  console.log(`\nFull results saved to data/conformance-test/results.json`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
