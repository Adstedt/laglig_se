/**
 * Amendment PDF Analysis Script
 *
 * Story 2.13 Task 1.1: Analyze sample amendment PDFs to understand structure variations
 *
 * Run with: pnpm tsx scripts/analyze-amendment-pdfs.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { extractText } from 'unpdf'

const FIXTURES_DIR = path.join(
  __dirname,
  '..',
  'tests',
  'fixtures',
  'amendment-pdfs'
)

interface AmendmentAnalysis {
  filename: string
  sfsNumber: string
  source: 'svenskforfattningssamling' | 'rkrattsdb'
  fileSize: number
  pageCount: number
  textLength: number
  baseLaw: string | null
  effectiveDate: string | null
  affectedSections: string[]
  structurePatterns: {
    hasIngressText: boolean
    hasTransitionProvisions: boolean
    hasSectionNumbers: boolean
    hasChapterNumbers: boolean
  }
  sampleText: string
  rawText: string
}

// Swedish amendment patterns
const PATTERNS = {
  // "Härigenom föreskrivs att X ska ha följande lydelse"
  ingressPattern: /Härigenom föreskrivs\s+(i fråga om|att|om)/i,

  // "i X (SFS YYYY:NNN)" - base law reference
  baseLawPattern: /i\s+([^(]+)\s*\((?:SFS\s*)?(\d{4}:\d+)\)/i,

  // "X § ska ha följande lydelse" or "X § upphävs"
  sectionAmendPattern:
    /(\d+(?:\s*[a-z])?)\s*§\s*ska\s+ha\s+följande\s+lydelse/gi,
  sectionRepealPattern: /(\d+(?:\s*[a-z])?)\s*§\s*upphävs/gi,
  sectionNewPattern: /ny(?:a)?\s+(?:paragraf(?:er)?|§|bestämmelse)/gi,

  // Chapter references: "X kap."
  chapterPattern: /(\d+)\s*kap\./gi,

  // Effective date: "Denna lag träder i kraft den X"
  effectiveDatePattern:
    /(?:Denna\s+(?:lag|förordning)|Lagen|Förordningen)\s+träder\s+i\s+kraft\s+den\s+(\d+\s+\w+\s+\d{4}|\d{1,2}\s+\w+\s+\d{4})/i,

  // Alternative effective date: "träder i kraft den 1 juli 2028"
  effectiveDateAltPattern:
    /träder\s+i\s+kraft\s+(?:den\s+)?(\d{1,2})\s+(\w+)\s+(\d{4})/i,

  // Transition provisions header
  transitionPattern: /Övergångsbestämmelser|Ikraftträdande/i,
}

const SWEDISH_MONTHS: Record<string, string> = {
  januari: '01',
  februari: '02',
  mars: '03',
  april: '04',
  maj: '05',
  juni: '06',
  juli: '07',
  augusti: '08',
  september: '09',
  oktober: '10',
  november: '11',
  december: '12',
}

function parseSwedishDate(dateStr: string): string | null {
  // Try "1 juli 2028" format
  const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (match) {
    const day = match[1].padStart(2, '0')
    const month = SWEDISH_MONTHS[match[2].toLowerCase()]
    const year = match[3]
    if (month) {
      return `${year}-${month}-${day}`
    }
  }
  return null
}

async function analyzePdf(filePath: string): Promise<AmendmentAnalysis | null> {
  const filename = path.basename(filePath)
  const stats = fs.statSync(filePath)

  // Determine source from filename
  const source = filename.includes('rkrattsdb')
    ? 'rkrattsdb'
    : 'svenskforfattningssamling'

  // Extract SFS number from filename (e.g., SFS2025-1461.pdf -> 2025:1461)
  const sfsMatch = filename.match(/SFS(\d{4})-(\d+)/)
  const sfsNumber = sfsMatch ? `${sfsMatch[1]}:${sfsMatch[2]}` : filename

  try {
    const dataBuffer = fs.readFileSync(filePath)
    const data = new Uint8Array(dataBuffer)

    // Extract text from all pages
    const result = await extractText(data, { mergePages: true })
    const text = result.text
    const numPages = result.totalPages || 1

    // Extract base law
    let baseLaw: string | null = null
    const baseLawMatch = text.match(PATTERNS.baseLawPattern)
    if (baseLawMatch) {
      baseLaw = `${baseLawMatch[1].trim()} (${baseLawMatch[2]})`
    }

    // Extract effective date
    let effectiveDate: string | null = null
    const effectiveDateMatch = text.match(PATTERNS.effectiveDateAltPattern)
    if (effectiveDateMatch) {
      const dateStr = `${effectiveDateMatch[1]} ${effectiveDateMatch[2]} ${effectiveDateMatch[3]}`
      effectiveDate = parseSwedishDate(dateStr)
    }

    // Extract affected sections
    const affectedSections: string[] = []

    // Find amended sections
    const amendMatches = text.matchAll(PATTERNS.sectionAmendPattern)
    for (const match of amendMatches) {
      affectedSections.push(`${match[1]} § (amended)`)
    }

    // Find repealed sections
    const repealMatches = text.matchAll(PATTERNS.sectionRepealPattern)
    for (const match of repealMatches) {
      affectedSections.push(`${match[1]} § (repealed)`)
    }

    // Detect structure patterns
    const structurePatterns = {
      hasIngressText: PATTERNS.ingressPattern.test(text),
      hasTransitionProvisions: PATTERNS.transitionPattern.test(text),
      hasSectionNumbers: /\d+\s*§/.test(text),
      hasChapterNumbers: PATTERNS.chapterPattern.test(text),
    }

    // Get sample text (first 1000 chars after cleaning)
    const cleanedText = text.replace(/\s+/g, ' ').trim()
    const sampleText = cleanedText.substring(0, 1000)

    return {
      filename,
      sfsNumber,
      source,
      fileSize: stats.size,
      pageCount: numPages,
      textLength: text.length,
      baseLaw,
      effectiveDate,
      affectedSections: [...new Set(affectedSections)], // Remove duplicates
      structurePatterns,
      sampleText,
      rawText: text,
    }
  } catch (error) {
    console.error(`Failed to parse ${filename}:`, error)
    return null
  }
}

async function main() {
  console.log('='.repeat(80))
  console.log('Amendment PDF Structure Analysis')
  console.log('Story 2.13 Task 1.1')
  console.log('='.repeat(80))
  console.log()

  // Get all PDFs in fixtures directory
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.pdf'))

  console.log(`Found ${files.length} PDF files to analyze\n`)

  const analyses: AmendmentAnalysis[] = []

  for (const file of files) {
    const filePath = path.join(FIXTURES_DIR, file)
    console.log(`Analyzing: ${file}...`)

    const analysis = await analyzePdf(filePath)
    if (analysis) {
      analyses.push(analysis)

      console.log(`  - SFS: ${analysis.sfsNumber}`)
      console.log(`  - Source: ${analysis.source}`)
      console.log(`  - Pages: ${analysis.pageCount}`)
      console.log(`  - Text length: ${analysis.textLength} chars`)
      console.log(`  - Base law: ${analysis.baseLaw || 'NOT DETECTED'}`)
      console.log(
        `  - Effective date: ${analysis.effectiveDate || 'NOT DETECTED'}`
      )
      console.log(
        `  - Sections affected: ${analysis.affectedSections.length > 0 ? analysis.affectedSections.join(', ') : 'NONE DETECTED'}`
      )
      console.log(
        `  - Has ingress: ${analysis.structurePatterns.hasIngressText}`
      )
      console.log(
        `  - Has chapters: ${analysis.structurePatterns.hasChapterNumbers}`
      )
      console.log()
    }
  }

  // Generate summary report
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY REPORT')
  console.log('='.repeat(80))

  const svfAnalyses = analyses.filter(
    (a) => a.source === 'svenskforfattningssamling'
  )
  const rkAnalyses = analyses.filter((a) => a.source === 'rkrattsdb')

  console.log(
    `\nSvenskforfattningssamling.se (2018+): ${svfAnalyses.length} documents`
  )
  console.log(`rkrattsdb.gov.se (pre-2018): ${rkAnalyses.length} documents`)

  // Structure analysis
  const withIngress = analyses.filter(
    (a) => a.structurePatterns.hasIngressText
  ).length
  const withChapters = analyses.filter(
    (a) => a.structurePatterns.hasChapterNumbers
  ).length
  const withEffectiveDate = analyses.filter((a) => a.effectiveDate).length
  const withBaseLaw = analyses.filter((a) => a.baseLaw).length

  console.log(`\nDetection rates:`)
  console.log(
    `  - Ingress text: ${withIngress}/${analyses.length} (${Math.round((100 * withIngress) / analyses.length)}%)`
  )
  console.log(
    `  - Chapter numbers: ${withChapters}/${analyses.length} (${Math.round((100 * withChapters) / analyses.length)}%)`
  )
  console.log(
    `  - Effective date: ${withEffectiveDate}/${analyses.length} (${Math.round((100 * withEffectiveDate) / analyses.length)}%)`
  )
  console.log(
    `  - Base law: ${withBaseLaw}/${analyses.length} (${Math.round((100 * withBaseLaw) / analyses.length)}%)`
  )

  // Save detailed analysis to research doc
  const researchOutput = generateResearchDoc(analyses)
  const outputPath = path.join(
    __dirname,
    '..',
    'docs',
    'research',
    'amendment-pdf-structure.md'
  )
  fs.writeFileSync(outputPath, researchOutput)
  console.log(`\nDetailed analysis saved to: ${outputPath}`)

  // Save raw text samples for debugging
  const samplesDir = path.join(
    __dirname,
    '..',
    'tests',
    'fixtures',
    'amendment-pdfs',
    'text-samples'
  )
  if (!fs.existsSync(samplesDir)) {
    fs.mkdirSync(samplesDir, { recursive: true })
  }

  for (const analysis of analyses) {
    const samplePath = path.join(
      samplesDir,
      `${analysis.sfsNumber.replace(':', '-')}.txt`
    )
    fs.writeFileSync(samplePath, analysis.rawText)
  }
  console.log(`Raw text samples saved to: ${samplesDir}`)
}

function generateResearchDoc(analyses: AmendmentAnalysis[]): string {
  const doc = `# Amendment PDF Structure Analysis

## Overview

This document contains the analysis of ${analyses.length} sample amendment PDFs from Swedish legal sources, conducted as part of Story 2.13 Task 1.1.

**Analysis Date:** ${new Date().toISOString().split('T')[0]}

## Sources Analyzed

### svenskforfattningssamling.se (2018+)

The modern source for Swedish statutes. PDFs are:
- Digitally signed
- Text-based (not scanned)
- Consistently formatted
- ~300-500KB average size

${analyses
  .filter((a) => a.source === 'svenskforfattningssamling')
  .map(
    (a) => `
#### ${a.sfsNumber}
- **File:** ${a.filename}
- **Pages:** ${a.pageCount}
- **Base law:** ${a.baseLaw || 'Not detected'}
- **Effective date:** ${a.effectiveDate || 'Not detected'}
- **Sections affected:** ${a.affectedSections.join(', ') || 'None detected'}
- **Sample text:** \`${a.sampleText.substring(0, 200)}...\`
`
  )
  .join('\n')}

### rkrattsdb.gov.se (1998-2018)

The historical archive. PDFs are:
- Smaller file sizes
- May be scanned (older documents)
- Variable formatting

${analyses
  .filter((a) => a.source === 'rkrattsdb')
  .map(
    (a) => `
#### ${a.sfsNumber}
- **File:** ${a.filename}
- **Pages:** ${a.pageCount}
- **Base law:** ${a.baseLaw || 'Not detected'}
- **Effective date:** ${a.effectiveDate || 'Not detected'}
- **Sections affected:** ${a.affectedSections.join(', ') || 'None detected'}
- **Sample text:** \`${a.sampleText.substring(0, 200)}...\`
`
  )
  .join('\n')}

## Common Structure Patterns

### Ingress (Opening Statement)

Most amendment documents begin with:
\`\`\`
Härigenom föreskrivs [i fråga om / att / om] ...
\`\`\`

This pattern identifies:
1. The type of legal instrument (lag/förordning)
2. The base law being amended
3. The nature of the changes

### Section Changes

Amendments use specific Swedish legal language:

| Pattern | Meaning |
|---------|---------|
| "X § ska ha följande lydelse" | Section X shall read as follows |
| "X § upphävs" | Section X is repealed |
| "ny X §" / "ny paragraf" | New section X inserted |
| "X kap." | Chapter X |

### Effective Date (Ikraftträdande)

Located at the end of the document:
\`\`\`
Denna lag träder i kraft den [DATE].
\`\`\`

Or in transition provisions (Övergångsbestämmelser).

## Regex Patterns for Parsing

### Base Law Detection
\`\`\`regex
i\\s+([^(]+)\\s*\\((?:SFS\\s*)?(\\d{4}:\\d+)\\)
\`\`\`

### Section Amendment Detection
\`\`\`regex
(\\d+(?:\\s*[a-z])?)\\s*§\\s*ska\\s+ha\\s+följande\\s+lydelse
\`\`\`

### Section Repeal Detection
\`\`\`regex
(\\d+(?:\\s*[a-z])?)\\s*§\\s*upphävs
\`\`\`

### Effective Date Detection
\`\`\`regex
träder\\s+i\\s+kraft\\s+(?:den\\s+)?(\\d{1,2})\\s+(\\w+)\\s+(\\d{4})
\`\`\`

## Key Findings

1. **Text Extraction Quality:** Modern PDFs (2018+) have excellent text extraction. Older PDFs vary.

2. **Structure Consistency:** Amendment documents follow a consistent structure:
   - Header/metadata
   - Ingress statement
   - Section changes
   - Transition provisions

3. **Detection Challenges:**
   - Complex amendments affecting multiple chapters
   - Renumbered sections
   - References to other laws

4. **Recommendations:**
   - Use pdf-parse for text extraction
   - Implement regex patterns above for structured parsing
   - Consider OCR (tesseract.js) for pre-2000 scanned PDFs
   - Store raw text alongside parsed structures for debugging

## Next Steps

- Task 1.2: Add SFS_AMENDMENT to ContentType enum
- Task 1.3: Prototype PDF parsing pipeline
- Task 1.4: Research SE-Lex patterns for additional insights
`

  return doc
}

main().catch(console.error)
