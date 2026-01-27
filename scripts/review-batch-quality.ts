#!/usr/bin/env tsx
/**
 * Batch Quality Review Script
 * Analyzes LLM batch results for quality assessment before production run
 */

import { readFileSync, writeFileSync } from 'fs'

interface ResultItem {
  custom_id: string
  result?: {
    type: string
    message?: {
      content?: Array<{ type: string; text?: string }>
      stop_reason?: string
    }
    error?: { message: string }
  }
}

interface QualityResult {
  id: string
  sfsNumber: string
  charCount: number
  textLength: number
  hasArticle: boolean
  hasBody: boolean
  hasSections: boolean
  hasChapters: boolean
  hasFootnotes: boolean
  hasTransitions: boolean
  hasSignature: boolean
  hasLists: boolean
  status: 'PASS' | 'WARNING' | 'ERROR'
  issues: string[]
}

function extractText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function analyzeResult(r: ResultItem): QualityResult {
  const id = r.custom_id
  const sfsNumber = id.replace('SFS', '').replace('-', ':')

  let html = r.result?.message?.content?.[0]?.text || ''
  // Remove markdown fences
  html = html.replace(/^```html\n?/i, '').replace(/\n?```$/i, '')

  const textContent = extractText(html)

  const hasArticle = html.includes('<article class="sfs"')
  const hasBody = html.includes('<div class="body"')
  const hasSections = html.includes('class="ann"')
  const hasChapters = html.includes('class="kapitel"')
  const hasFootnotes = html.includes('footnote')
  const hasTransitions =
    html.includes('Ikraftträdande') || html.includes('träder i kraft')
  const hasSignature = html.includes('regeringens vägnar')
  const hasLists =
    html.includes('<ol class="list"') || html.includes('<ul class="list"')

  const issues: string[] = []

  if (!hasArticle) issues.push('MISSING_ARTICLE')
  if (!hasBody) issues.push('MISSING_BODY')
  if (!hasSections && !hasChapters) issues.push('NO_SECTIONS')
  if (!hasTransitions && !hasSignature) issues.push('NO_FOOTER_CONTENT')
  if (textContent.length < 200) issues.push('TOO_SHORT')

  let status: 'PASS' | 'WARNING' | 'ERROR' = 'PASS'
  if (issues.includes('MISSING_ARTICLE') || issues.includes('TOO_SHORT')) {
    status = 'ERROR'
  } else if (issues.length > 0) {
    status = 'WARNING'
  }

  return {
    id,
    sfsNumber,
    charCount: html.length,
    textLength: textContent.length,
    hasArticle,
    hasBody,
    hasSections,
    hasChapters,
    hasFootnotes,
    hasTransitions,
    hasSignature,
    hasLists,
    status,
    issues,
  }
}

function main() {
  const resultsFile =
    process.argv[2] || 'results/msgbatch_013GhaXV767FaagfG5nVR1HL.jsonl'

  console.log('='.repeat(70))
  console.log('BATCH LLM PARSING QUALITY REPORT')
  console.log('='.repeat(70))
  console.log(`Results file: ${resultsFile}`)
  console.log('')

  const content = readFileSync(resultsFile, 'utf8')
  const lines = content.trim().split('\n')

  const results: QualityResult[] = []
  let apiErrors = 0

  for (const line of lines) {
    const r = JSON.parse(line) as ResultItem

    if (r.result?.type === 'error') {
      apiErrors++
      continue
    }

    results.push(analyzeResult(r))
  }

  // Summary
  const passed = results.filter((r) => r.status === 'PASS').length
  const warnings = results.filter((r) => r.status === 'WARNING').length
  const errors = results.filter((r) => r.status === 'ERROR').length

  console.log('SUMMARY')
  console.log('-'.repeat(40))
  console.log(`Total documents processed: ${results.length}`)
  console.log(`API errors: ${apiErrors}`)
  console.log(``)
  console.log(
    `✅ Passed: ${passed} (${((passed / results.length) * 100).toFixed(1)}%)`
  )
  console.log(`⚠️  Warnings: ${warnings}`)
  console.log(`❌ Errors: ${errors}`)
  console.log('')

  // Size distribution
  const sizes = results.map((r) => r.textLength).sort((a, b) => a - b)
  console.log('SIZE DISTRIBUTION')
  console.log('-'.repeat(40))
  console.log(`Min: ${sizes[0]} chars`)
  console.log(`Max: ${sizes[sizes.length - 1]} chars`)
  console.log(`Median: ${sizes[Math.floor(sizes.length / 2)]} chars`)
  console.log(
    `Average: ${Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length)} chars`
  )
  console.log('')

  // Structure coverage
  console.log('STRUCTURE COVERAGE')
  console.log('-'.repeat(40))
  console.log(
    `Has article wrapper: ${results.filter((r) => r.hasArticle).length}/${results.length}`
  )
  console.log(
    `Has body div: ${results.filter((r) => r.hasBody).length}/${results.length}`
  )
  console.log(
    `Has sections (§): ${results.filter((r) => r.hasSections).length}/${results.length}`
  )
  console.log(
    `Has chapters (kap.): ${results.filter((r) => r.hasChapters).length}/${results.length}`
  )
  console.log(
    `Has footnotes: ${results.filter((r) => r.hasFootnotes).length}/${results.length}`
  )
  console.log(
    `Has transitions: ${results.filter((r) => r.hasTransitions).length}/${results.length}`
  )
  console.log(
    `Has signature: ${results.filter((r) => r.hasSignature).length}/${results.length}`
  )
  console.log(
    `Has lists: ${results.filter((r) => r.hasLists).length}/${results.length}`
  )
  console.log('')

  // Documents with issues
  const docsWithIssues = results.filter((r) => r.issues.length > 0)
  if (docsWithIssues.length > 0) {
    console.log('DOCUMENTS REQUIRING REVIEW')
    console.log('-'.repeat(40))
    for (const doc of docsWithIssues) {
      const icon = doc.status === 'ERROR' ? '❌' : '⚠️'
      console.log(`${icon} ${doc.sfsNumber}: ${doc.issues.join(', ')}`)
    }
    console.log('')
  }

  // Sample outputs for manual inspection
  console.log('SAMPLE OUTPUTS FOR MANUAL REVIEW')
  console.log('-'.repeat(40))
  const samples = [
    results.find((r) => r.charCount > 8000), // Large doc
    results.find((r) => r.charCount < 1000 && r.status === 'PASS'), // Small doc
    results.find((r) => r.hasChapters && r.hasFootnotes), // Complex doc
  ].filter(Boolean)

  for (const sample of samples) {
    if (!sample) continue
    console.log(
      `- ${sample.sfsNumber}: ${sample.textLength} chars, ` +
        `${sample.hasSections ? 'has sections' : 'no sections'}, ` +
        `${sample.hasFootnotes ? 'has footnotes' : 'no footnotes'}`
    )
  }
  console.log('')

  // Quality score
  const qualityScore = (passed / results.length) * 100
  console.log('='.repeat(70))
  console.log(`OVERALL QUALITY SCORE: ${qualityScore.toFixed(1)}%`)
  if (qualityScore >= 90) {
    console.log('✅ RECOMMENDATION: Proceed with full batch run')
  } else if (qualityScore >= 70) {
    console.log('⚠️ RECOMMENDATION: Review issues before proceeding')
  } else {
    console.log('❌ RECOMMENDATION: Fix prompt issues before proceeding')
  }
  console.log('='.repeat(70))

  // Export detailed results
  const outputFile = resultsFile.replace('.jsonl', '-quality-report.json')
  writeFileSync(
    outputFile,
    JSON.stringify(
      { summary: { passed, warnings, errors, qualityScore }, results },
      null,
      2
    )
  )
  console.log(`\nDetailed report saved to: ${outputFile}`)
}

main()
