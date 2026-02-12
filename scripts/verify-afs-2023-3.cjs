#!/usr/bin/env node
/**
 * Verify AFS 2023:3 ingestion completeness
 * Checks that all 11 chapters and all § within each chapter are present
 */

const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();

// Expected structure of AFS 2023:3 (from the PDF TOC)
// 11 chapters across 3 avdelningar (divisions)
const EXPECTED_CHAPTERS = [
  { num: 1, title: 'Allmänna bestämmelser' },
  { num: 2, title: 'Gemensamma bestämmelser om projektering' },
  { num: 3, title: 'Projektering av byggnader' },
  { num: 4, title: 'Projektering av anläggningar' },
  { num: 5, title: 'Byggarbetsmiljösamordning under projektering' },
  { num: 6, title: 'Gemensamma bestämmelser om byggnads- och anläggningsarbete' },
  { num: 7, title: 'Byggnads- och anläggningsarbete' },
  { num: 8, title: 'Rivning' },
  { num: 9, title: 'Byggarbetsmiljösamordning under utförande' },
  { num: 10, title: 'Övergångsbestämmelser' },
  { num: 11, title: 'Ikraftträdande- och övergångsbestämmelser' },
];

/**
 * Extract chapter sections from HTML/text and report what's found
 */
function analyzeChapters(text) {
  const found = {};

  // Match "N kap." or "Kapitel N" patterns
  const kapPatterns = [
    /(\d+)\s*kap\./gi,
    /Kapitel\s+(\d+)/gi,
  ];

  for (const pattern of kapPatterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const num = parseInt(m[1], 10);
      if (!found[num]) found[num] = { refs: 0 };
      found[num].refs++;
    }
  }

  return found;
}

/**
 * Extract § numbers and group by chapter context
 */
function analyzeParagraphs(text) {
  // Find all § references: "1 §", "2 §", "17 a §" etc.
  const allParagraphs = [];
  const regex = /(\d+(?:\s*[a-z])?\s*§)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const cleaned = m[1].replace(/\s+/g, ' ').trim();
    const num = parseInt(cleaned, 10);
    allParagraphs.push({ raw: cleaned, num, index: m.index });
  }

  // Get unique § numbers
  const uniqueNums = [...new Set(allParagraphs.map(p => p.num))].sort((a, b) => a - b);

  // Check for gaps in numbering
  const gaps = [];
  for (let i = 1; i < uniqueNums.length; i++) {
    const prev = uniqueNums[i - 1];
    const curr = uniqueNums[i];
    if (curr - prev > 1) {
      for (let g = prev + 1; g < curr; g++) {
        gaps.push(g);
      }
    }
  }

  return {
    total: allParagraphs.length,
    unique: uniqueNums,
    uniqueCount: uniqueNums.length,
    highest: uniqueNums.length > 0 ? Math.max(...uniqueNums) : 0,
    gaps,
  };
}

/**
 * Try to split text by chapter boundaries and count § per chapter
 */
function analyzePerChapter(fullText) {
  const results = [];

  // Try to find chapter boundaries using "N kap." headings
  // Look for patterns like "1 kap. Allmänna bestämmelser" as section headers
  const chapterSections = [];
  const chapterHeaderRegex = /(\d+)\s*kap\.\s+([^\n]+)/g;
  let m;
  const headers = [];
  while ((m = chapterHeaderRegex.exec(fullText)) !== null) {
    headers.push({ num: parseInt(m[1], 10), title: m[2].trim(), index: m.index });
  }

  // Deduplicate — take the first occurrence of each chapter number (likely the heading)
  const seenChapters = new Set();
  const uniqueHeaders = headers.filter(h => {
    if (seenChapters.has(h.num)) return false;
    seenChapters.add(h.num);
    return true;
  });

  for (let i = 0; i < uniqueHeaders.length; i++) {
    const header = uniqueHeaders[i];
    const nextHeader = uniqueHeaders[i + 1];
    const start = header.index;
    const end = nextHeader ? nextHeader.index : fullText.length;
    const section = fullText.substring(start, end);

    // Count § in this chapter section
    const paragraphs = [];
    const pRegex = /(\d+(?:\s*[a-z])?\s*§)/g;
    let pm;
    while ((pm = pRegex.exec(section)) !== null) {
      const num = parseInt(pm[1], 10);
      paragraphs.push(num);
    }
    const uniqueP = [...new Set(paragraphs)].sort((a, b) => a - b);

    results.push({
      chapter: header.num,
      title: header.title.substring(0, 50),
      charCount: section.length,
      paragraphCount: uniqueP.length,
      paragraphs: uniqueP,
      highest: uniqueP.length > 0 ? Math.max(...uniqueP) : 0,
    });
  }

  return results;
}

async function run() {
  const doc = await p.legalDocument.findUnique({
    where: { document_number: 'AFS 2023:3' },
    select: {
      document_number: true,
      title: true,
      html_content: true,
      markdown_content: true,
      full_text: true,
      status: true,
      created_at: true,
      updated_at: true,
    },
  });

  if (!doc) {
    console.error('AFS 2023:3 not found in database!');
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('AFS 2023:3 Ingestion Verification');
  console.log('='.repeat(70));
  console.log();

  // Basic info
  console.log('--- Document Info ---');
  console.log(`  Title: ${doc.title}`);
  console.log(`  Status: ${doc.status}`);
  console.log(`  Created: ${doc.created_at}`);
  console.log(`  Updated: ${doc.updated_at}`);
  console.log(`  HTML length: ${(doc.html_content || '').length} chars`);
  console.log(`  Markdown length: ${(doc.markdown_content || '').length} chars`);
  console.log(`  Full text length: ${(doc.full_text || '').length} chars`);
  console.log();

  const text = doc.full_text || doc.markdown_content || '';
  const html = doc.html_content || '';

  if (!text && !html) {
    console.error('  NO CONTENT FOUND — document is empty!');
    process.exit(1);
  }

  // Chapter analysis
  console.log('--- Chapter Check ---');
  const chaptersFound = analyzeChapters(text || html);
  const foundNums = Object.keys(chaptersFound).map(Number).sort((a, b) => a - b);

  console.log(`  Expected chapters: ${EXPECTED_CHAPTERS.length} (kap. 1–${EXPECTED_CHAPTERS.length})`);
  console.log(`  Found chapter refs: ${foundNums.join(', ') || 'NONE'}`);

  const missingChapters = EXPECTED_CHAPTERS.filter(ch => !foundNums.includes(ch.num));
  if (missingChapters.length > 0) {
    console.log(`  MISSING chapters: ${missingChapters.map(ch => `kap. ${ch.num} (${ch.title})`).join(', ')}`);
  } else {
    console.log(`  All ${EXPECTED_CHAPTERS.length} chapters referenced`);
  }
  console.log();

  // Overall § analysis
  console.log('--- Overall § Analysis ---');
  const pStats = analyzeParagraphs(text || html);
  console.log(`  Total § references: ${pStats.total}`);
  console.log(`  Unique § numbers: ${pStats.uniqueCount}`);
  console.log(`  Highest §: ${pStats.highest}`);
  if (pStats.gaps.length > 0 && pStats.gaps.length <= 20) {
    console.log(`  Missing § numbers (gaps): ${pStats.gaps.join(', ')}`);
  } else if (pStats.gaps.length > 20) {
    console.log(`  Missing § numbers: ${pStats.gaps.length} gaps (expected — § numbering restarts per chapter)`);
  }
  console.log();

  // Per-chapter breakdown
  console.log('--- Per-Chapter § Breakdown ---');
  const perChapter = analyzePerChapter(text || html);

  if (perChapter.length === 0) {
    console.log('  Could not split by chapter boundaries — trying HTML');
    // Fallback: try HTML
    const htmlPerChapter = analyzePerChapter(html);
    if (htmlPerChapter.length > 0) {
      printChapterTable(htmlPerChapter);
    } else {
      console.log('  Could not detect chapter boundaries in content');
    }
  } else {
    printChapterTable(perChapter);
  }

  console.log();
  console.log('='.repeat(70));

  // Summary verdict
  const hasAllChapters = missingChapters.length === 0;
  const hasContent = (text || html).length > 5000; // reasonable minimum
  const hasParagraphs = pStats.uniqueCount > 10; // should have many §

  if (hasAllChapters && hasContent && hasParagraphs) {
    console.log('VERDICT: PASS — All chapters present, content looks complete');
  } else {
    console.log('VERDICT: NEEDS REVIEW');
    if (!hasAllChapters) console.log(`  - Missing ${missingChapters.length} chapters`);
    if (!hasContent) console.log(`  - Content too short (${(text || html).length} chars)`);
    if (!hasParagraphs) console.log(`  - Too few § references (${pStats.uniqueCount})`);
  }

  console.log('='.repeat(70));

  await p.$disconnect();
}

function printChapterTable(chapters) {
  console.log('  ' + 'Kap.'.padEnd(6) + 'Title'.padEnd(52) + '§ count'.padEnd(10) + 'Highest §'.padEnd(12) + 'Chars');
  console.log('  ' + '-'.repeat(86));
  for (const ch of chapters) {
    console.log(
      '  ' +
      String(ch.chapter).padEnd(6) +
      ch.title.padEnd(52) +
      String(ch.paragraphCount).padEnd(10) +
      String(ch.highest || '-').padEnd(12) +
      ch.charCount
    );
  }
}

run().catch(e => { console.error(e); process.exit(1); });
