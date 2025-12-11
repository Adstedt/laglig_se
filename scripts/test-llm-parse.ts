/**
 * Test LLM-assisted parsing on amendment PDFs
 * Compares regex output vs LLM output
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { parsePdfFromPath } from '../lib/external/pdf-parser'
import { parseAmendmentWithLLM, type ParsedAmendmentLLM } from '../lib/external/llm-amendment-parser'
import * as path from 'path'
import * as fs from 'fs'

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'amendment-pdfs')

async function testSingleDocument(filename: string) {
  const filePath = path.join(FIXTURES_DIR, filename)

  console.log(`\n${'='.repeat(70)}`)
  console.log(`Testing: ${filename}`)
  console.log('='.repeat(70))

  // Get regex-based parse
  const regexResult = await parsePdfFromPath(filePath)

  console.log('\n📊 REGEX PARSE:')
  console.log(`   Base law: ${regexResult.baseLaw?.name} (${regexResult.baseLaw?.sfsNumber})`)
  console.log(`   Effective: ${regexResult.effectiveDate}`)
  console.log(`   Sections: ${regexResult.affectedSections.length}`)

  // Get LLM parse
  console.log('\n🤖 LLM PARSE: (calling Claude...)')
  const llmResult = await parseAmendmentWithLLM(regexResult.fullText)

  console.log(`   Base law: ${llmResult.baseLaw.name} (${llmResult.baseLaw.sfsNumber})`)
  console.log(`   Effective: ${llmResult.effectiveDate}`)
  console.log(`   Published: ${llmResult.publicationDate}`)
  console.log(`   Confidence: ${(llmResult.confidence * 100).toFixed(0)}%`)
  console.log(`   Sections: ${llmResult.affectedSections.length}`)

  // List all sections
  llmResult.affectedSections.forEach(s => {
    const loc = s.chapter ? `${s.chapter} kap. ${s.section} §` : `${s.section} §`
    console.log(`      - ${loc} (${s.changeType}) ${s.description}`)
  })

  if (llmResult.transitionalProvisions?.length) {
    console.log(`   Transitional: ${llmResult.transitionalProvisions.length} provisions`)
  }

  // Compare
  console.log('\n📈 COMPARISON:')
  console.log(`   Regex: ${regexResult.affectedSections.length} sections`)
  console.log(`   LLM:   ${llmResult.affectedSections.length} sections`)
  console.log(`   Diff:  +${llmResult.affectedSections.length - regexResult.affectedSections.length} more from LLM`)

  return {
    filename,
    regexSections: regexResult.affectedSections.length,
    llmSections: llmResult.affectedSections.length,
    confidence: llmResult.confidence,
    llmResult
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args[0] === '--all') {
    // Test all fixtures
    const files = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.pdf'))
    const results: Array<{ filename: string; regexSections: number; llmSections: number; confidence: number }> = []

    for (const file of files) {
      try {
        const result = await testSingleDocument(file)
        results.push(result)
      } catch (error) {
        console.error(`\n❌ Error processing ${file}:`, error)
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70))
    console.log('SUMMARY')
    console.log('='.repeat(70))
    console.log('\n| File | Regex | LLM | Confidence |')
    console.log('|------|-------|-----|------------|')
    let totalRegex = 0, totalLLM = 0
    results.forEach(r => {
      console.log(`| ${r.filename} | ${r.regexSections} | ${r.llmSections} | ${(r.confidence * 100).toFixed(0)}% |`)
      totalRegex += r.regexSections
      totalLLM += r.llmSections
    })
    console.log(`\nTotal sections found: Regex=${totalRegex}, LLM=${totalLLM}`)
    console.log(`LLM found ${totalLLM - totalRegex} more sections than regex`)

  } else {
    // Test single file (default: SFS2022-1109.pdf - our most complex one)
    const testFile = args[0] || 'SFS2022-1109.pdf'
    await testSingleDocument(testFile)
  }
}

main().catch(console.error)
