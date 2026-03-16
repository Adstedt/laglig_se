#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Evaluate JSON chunking on SFS 1977:1160 (Arbetsmiljölagen)
 *
 * Pulls html_content from DB, runs canonical parser, outputs stats + sample.
 */

import { prisma } from '../lib/prisma'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { validateCanonicalJson } from '../lib/transforms/validate-document-json'
import type {
  CanonicalDocumentJson,
  CanonicalChapter,
} from '../lib/transforms/document-json-schema'

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: {
      id: true,
      title: true,
      document_number: true,
      html_content: true,
    },
  })

  if (!doc) {
    console.error('Document 1977:1160 not found in DB')
    process.exit(1)
  }

  console.log(`\n=== ${doc.title} (${doc.document_number}) ===`)
  console.log(`HTML length: ${doc.html_content?.length ?? 0} chars\n`)

  if (!doc.html_content) {
    console.error('No html_content')
    process.exit(1)
  }

  // Parse
  const json = parseCanonicalHtml(doc.html_content, {
    sfsNumber: doc.document_number ?? undefined,
    documentType: 'SFS_LAW',
  })

  // Validate
  const validation = validateCanonicalJson(json)
  console.log(`Schema valid: ${validation.success}`)
  if (!validation.success) {
    console.log('Validation errors:', validation.errors)
  }

  // Stats
  printStats(json)

  // Write full JSON to file for inspection
  const fs = await import('fs')
  const outPath = 'data/sfs-law-arbetsmiljolagen-parsed.json'
  fs.writeFileSync(outPath, JSON.stringify(json, null, 2))
  console.log(`\nFull JSON written to: ${outPath}`)

  // Sample: show first 2 chapters
  console.log('\n=== SAMPLE: First 2 chapters ===')
  const allChapters = json.divisions
    ? json.divisions.flatMap((d) => d.chapters)
    : json.chapters

  for (const ch of allChapters.slice(0, 2)) {
    printChapter(ch)
  }

  // Show last chapter too for variety
  if (allChapters.length > 2) {
    console.log(`\n... (${allChapters.length - 3} more chapters) ...\n`)
    printChapter(allChapters[allChapters.length - 1]!)
  }

  // Check for potential issues
  console.log('\n=== QUALITY CHECKS ===')
  checkQuality(json, allChapters)

  await prisma.$disconnect()
}

function printStats(json: CanonicalDocumentJson) {
  const allChapters = json.divisions
    ? json.divisions.flatMap((d) => d.chapters)
    : json.chapters

  const totalSections = allChapters.reduce(
    (sum, ch) => sum + ch.sections.length,
    0
  )
  const totalParagraphs = allChapters.reduce(
    (sum, ch) =>
      sum + ch.sections.reduce((s, sec) => s + sec.paragraphs.length, 0),
    0
  )

  const roles = new Map<string, number>()
  for (const ch of allChapters) {
    for (const sec of ch.sections) {
      for (const p of sec.paragraphs) {
        roles.set(p.role, (roles.get(p.role) || 0) + 1)
      }
    }
  }

  console.log(`Document type: ${json.documentType}`)
  console.log(`Title: ${json.title}`)
  console.log(`Document number: ${json.documentNumber}`)
  console.log(
    `Has divisions: ${json.divisions !== null} (${json.divisions?.length ?? 0})`
  )
  console.log(`Chapters: ${allChapters.length}`)
  console.log(`Sections (§): ${totalSections}`)
  console.log(`Paragraphs: ${totalParagraphs}`)
  console.log(`Preamble: ${json.preamble !== null}`)
  console.log(
    `Transition provisions: ${json.transitionProvisions?.length ?? 0}`
  )
  console.log(`Appendices: ${json.appendices?.length ?? 0}`)
  console.log(`\nContent roles:`)
  for (const [role, count] of [...roles.entries()].sort()) {
    console.log(`  ${role}: ${count}`)
  }
}

function printChapter(ch: CanonicalChapter) {
  console.log(
    `\n--- Chapter ${ch.number ?? '(implicit)'}: ${ch.title ?? '(no title)'} ---`
  )
  console.log(`  Sections: ${ch.sections.length}`)
  for (const sec of ch.sections.slice(0, 3)) {
    console.log(`  § ${sec.number}${sec.heading ? ` — ${sec.heading}` : ''}`)
    for (const p of sec.paragraphs.slice(0, 2)) {
      const preview =
        p.text.length > 100 ? p.text.slice(0, 100) + '...' : p.text
      console.log(`    [${p.role}] ${preview}`)
    }
    if (sec.paragraphs.length > 2) {
      console.log(`    ... (${sec.paragraphs.length - 2} more paragraphs)`)
    }
  }
  if (ch.sections.length > 3) {
    console.log(`  ... (${ch.sections.length - 3} more sections)`)
  }
}

function checkQuality(
  json: CanonicalDocumentJson,
  allChapters: CanonicalChapter[]
) {
  // 1. Empty sections
  const emptySections = allChapters.flatMap((ch) =>
    ch.sections
      .filter((s) => s.paragraphs.length === 0)
      .map((s) => `${ch.number} kap. ${s.number} §`)
  )
  if (emptySections.length > 0) {
    console.log(`⚠ Empty sections (no paragraphs): ${emptySections.length}`)
    emptySections.slice(0, 5).forEach((s) => console.log(`  - ${s}`))
  } else {
    console.log('✓ No empty sections')
  }

  // 2. Very short paragraphs (possibly parsing artifacts)
  let shortCount = 0
  for (const ch of allChapters) {
    for (const sec of ch.sections) {
      for (const p of sec.paragraphs) {
        if (p.text.length < 5 && p.role === 'PARAGRAPH') shortCount++
      }
    }
  }
  console.log(
    shortCount > 0
      ? `⚠ Very short paragraphs (<5 chars): ${shortCount}`
      : '✓ No suspiciously short paragraphs'
  )

  // 3. Section number gaps
  for (const ch of allChapters) {
    const nums = ch.sections
      .map((s) => parseInt(s.number))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b)
    const gaps: number[] = []
    for (let i = 1; i < nums.length; i++) {
      if (nums[i]! - nums[i - 1]! > 1) {
        for (let g = nums[i - 1]! + 1; g < nums[i]!; g++) {
          gaps.push(g)
        }
      }
    }
    if (gaps.length > 0) {
      console.log(
        `⚠ Chapter ${ch.number}: missing § numbers: ${gaps.join(', ')}`
      )
    }
  }

  // 4. Transition provisions
  if (json.transitionProvisions && json.transitionProvisions.length > 0) {
    console.log(
      `✓ Transition provisions captured: ${json.transitionProvisions.length}`
    )
  } else {
    console.log('⚠ No transition provisions found (expected for 1977:1160)')
  }

  // 5. Appendices
  if (json.appendices && json.appendices.length > 0) {
    console.log(`✓ Appendices captured: ${json.appendices.length}`)
  }
}

main().catch(console.error)
