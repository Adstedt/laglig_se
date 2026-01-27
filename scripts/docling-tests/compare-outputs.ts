/**
 * Compare Docling Output vs Existing LLM-Generated HTML
 *
 * Analyzes the semantic structure differences between:
 * - Docling's HTML/JSON output
 * - Your existing Notisum-style HTML from LLM batch processing
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'

const SCRIPT_DIR = __dirname
const DOCLING_DIR = join(SCRIPT_DIR, 'output', 'docling')
const EXISTING_DIR = join(SCRIPT_DIR, 'output', 'existing-html')
const MANIFEST_PATH = join(SCRIPT_DIR, 'manifest.json')

interface HtmlAnalysis {
  totalLength: number
  tagCounts: Record<string, number>
  semanticElements: string[]
  headingLevels: number[]
  hasSections: boolean
  hasArticle: boolean
  hasFooter: boolean
  listCount: number
  tableCount: number
  footnoteCount: number
  sfsReferences: string[]
}

function analyzeHtml(html: string): HtmlAnalysis {
  const tagPattern = /<(\w+)[^>]*>/g
  const tagCounts: Record<string, number> = {}
  let match

  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase()
    tagCounts[tag] = (tagCounts[tag] || 0) + 1
  }

  // Find semantic elements
  const semanticTags = [
    'article',
    'section',
    'header',
    'footer',
    'nav',
    'aside',
    'main',
    'figure',
    'figcaption',
  ]
  const semanticElements = semanticTags.filter((tag) => tagCounts[tag] > 0)

  // Count heading levels
  const headingLevels: number[] = []
  for (let i = 1; i <= 6; i++) {
    if (tagCounts[`h${i}`] > 0) {
      headingLevels.push(i)
    }
  }

  // Count lists and tables
  const listCount = (tagCounts['ol'] || 0) + (tagCounts['ul'] || 0)
  const tableCount = tagCounts['table'] || 0

  // Count footnotes (looking for common patterns)
  const footnotePattern =
    /class="footnote|data-footnote|<sup[^>]*>\d+\)|footnote-/gi
  const footnoteMatches = html.match(footnotePattern)
  const footnoteCount = footnoteMatches?.length || 0

  // Find SFS references
  const sfsPattern = /SFS\s*\d{4}:\d+|\(\d{4}:\d+\)/g
  const sfsMatches = html.match(sfsPattern)
  const sfsReferences = [...new Set(sfsMatches || [])]

  return {
    totalLength: html.length,
    tagCounts,
    semanticElements,
    headingLevels,
    hasSections: (tagCounts['section'] || 0) > 0,
    hasArticle: (tagCounts['article'] || 0) > 0,
    hasFooter: (tagCounts['footer'] || 0) > 0,
    listCount,
    tableCount,
    footnoteCount,
    sfsReferences: sfsReferences.slice(0, 10), // First 10
  }
}

function formatTagCounts(counts: Record<string, number>): string {
  const relevant = [
    'article',
    'section',
    'div',
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'ol',
    'ul',
    'li',
    'table',
    'footer',
    'header',
    'span',
    'a',
  ]
  return relevant
    .filter((tag) => counts[tag] > 0)
    .map((tag) => `${tag}:${counts[tag]}`)
    .join(', ')
}

async function main() {
  if (!existsSync(MANIFEST_PATH)) {
    console.log(
      'Error: manifest.json not found. Run fetch-amendments.ts first.'
    )
    return
  }

  if (!existsSync(DOCLING_DIR)) {
    console.log('Error: Docling output not found. Run run-docling.py first.')
    return
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  console.log(`\nComparing ${manifest.length} documents...\n`)
  console.log('='.repeat(80))

  const comparisons: Array<{
    sfs: string
    existing: HtmlAnalysis
    docling: HtmlAnalysis
    doclingJson: any
  }> = []

  for (const item of manifest) {
    const safeName = item.sfs.replace(':', '-')

    const existingHtmlPath = join(EXISTING_DIR, `${safeName}.html`)
    const doclingHtmlPath = join(DOCLING_DIR, `${safeName}.html`)
    const doclingJsonPath = join(DOCLING_DIR, `${safeName}.json`)
    const doclingMdPath = join(DOCLING_DIR, `${safeName}.md`)

    if (!existsSync(doclingHtmlPath)) {
      console.log(`⚠️ ${item.sfs}: Docling output not found, skipping`)
      continue
    }

    console.log(`\n📄 ${item.sfs}`)
    console.log(`   ${item.title?.substring(0, 60) || 'No title'}`)
    console.log('-'.repeat(80))

    const existingHtml = existsSync(existingHtmlPath)
      ? readFileSync(existingHtmlPath, 'utf-8')
      : ''
    const doclingHtml = readFileSync(doclingHtmlPath, 'utf-8')
    const doclingJson = existsSync(doclingJsonPath)
      ? JSON.parse(readFileSync(doclingJsonPath, 'utf-8'))
      : null
    const doclingMd = existsSync(doclingMdPath)
      ? readFileSync(doclingMdPath, 'utf-8')
      : ''

    const existingAnalysis = analyzeHtml(existingHtml)
    const doclingAnalysis = analyzeHtml(doclingHtml)

    console.log('\n   EXISTING (LLM-generated Notisum-style):')
    console.log(
      `   - Length: ${existingAnalysis.totalLength.toLocaleString()} chars`
    )
    console.log(
      `   - Semantic elements: ${existingAnalysis.semanticElements.join(', ') || 'none'}`
    )
    console.log(
      `   - Headings: ${existingAnalysis.headingLevels.map((l) => `h${l}`).join(', ') || 'none'}`
    )
    console.log(`   - Tags: ${formatTagCounts(existingAnalysis.tagCounts)}`)
    console.log(
      `   - Lists: ${existingAnalysis.listCount}, Tables: ${existingAnalysis.tableCount}`
    )
    console.log(`   - Footnotes: ${existingAnalysis.footnoteCount}`)
    console.log(`   - SFS refs: ${existingAnalysis.sfsReferences.length}`)

    console.log('\n   DOCLING OUTPUT:')
    console.log(
      `   - HTML length: ${doclingAnalysis.totalLength.toLocaleString()} chars`
    )
    console.log(
      `   - Semantic elements: ${doclingAnalysis.semanticElements.join(', ') || 'none'}`
    )
    console.log(
      `   - Headings: ${doclingAnalysis.headingLevels.map((l) => `h${l}`).join(', ') || 'none'}`
    )
    console.log(`   - Tags: ${formatTagCounts(doclingAnalysis.tagCounts)}`)
    console.log(
      `   - Lists: ${doclingAnalysis.listCount}, Tables: ${doclingAnalysis.tableCount}`
    )
    console.log(
      `   - Markdown length: ${doclingMd.length.toLocaleString()} chars`
    )

    // Analyze Docling JSON structure
    if (doclingJson) {
      const docTypes = doclingJson.texts?.map((t: any) => t.label) || []
      const uniqueTypes = [...new Set(docTypes)]
      console.log(`\n   DOCLING JSON STRUCTURE:`)
      console.log(`   - Text items: ${doclingJson.texts?.length || 0}`)
      console.log(`   - Item types: ${uniqueTypes.slice(0, 8).join(', ')}`)
      console.log(`   - Tables: ${doclingJson.tables?.length || 0}`)
      console.log(`   - Pictures: ${doclingJson.pictures?.length || 0}`)
    }

    console.log('\n   KEY DIFFERENCES:')
    if (existingAnalysis.hasArticle && !doclingAnalysis.hasArticle) {
      console.log('   ⚠️  Existing has <article>, Docling does not')
    }
    if (existingAnalysis.hasSections && !doclingAnalysis.hasSections) {
      console.log('   ⚠️  Existing has <section>, Docling does not')
    }
    if (existingAnalysis.hasFooter && !doclingAnalysis.hasFooter) {
      console.log('   ⚠️  Existing has <footer>, Docling does not')
    }
    if (
      existingAnalysis.footnoteCount > 0 &&
      doclingAnalysis.footnoteCount === 0
    ) {
      console.log(
        `   ⚠️  Existing has ${existingAnalysis.footnoteCount} footnotes, Docling has none`
      )
    }
    if (
      existingAnalysis.sfsReferences.length >
      doclingAnalysis.sfsReferences.length
    ) {
      console.log(
        `   ⚠️  Existing has ${existingAnalysis.sfsReferences.length} SFS refs, Docling has ${doclingAnalysis.sfsReferences.length}`
      )
    }

    comparisons.push({
      sfs: item.sfs,
      existing: existingAnalysis,
      docling: doclingAnalysis,
      doclingJson,
    })
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))

  console.log('\nExisting HTML (LLM-generated):')
  console.log('- Uses semantic HTML5: <article>, <section>, <footer>')
  console.log(
    '- Custom classes for legal structure: kapitel, paragraf, in-force-info'
  )
  console.log('- Footnote handling with data-attributes')
  console.log('- SFS cross-reference links')

  console.log('\nDocling Output:')
  console.log('- Standard HTML5 elements: <h1>-<h6>, <p>, <div>')
  console.log('- No semantic wrappers (<article>, <section>)')
  console.log('- JSON output provides structured data for custom rendering')
  console.log('- Layout-aware text extraction preserves reading order')

  console.log('\nRECOMMENDATION:')
  console.log(
    "Use Docling's JSON output as extraction layer, then transform to your Notisum HTML format."
  )

  // Save detailed comparison
  const reportPath = join(SCRIPT_DIR, 'output', 'comparison-report.json')
  writeFileSync(reportPath, JSON.stringify(comparisons, null, 2))
  console.log(`\nDetailed report saved to: ${reportPath}`)
}

main().catch(console.error)
