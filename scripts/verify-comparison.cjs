#!/usr/bin/env node
/**
 * Side-by-side comparison: PDF § counts vs DB § counts
 * Flags documents where DB content might be incomplete
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const p = new PrismaClient();
const PDF_DIR = path.resolve(__dirname, '../data/afs-pdfs');

function countParagraphs(text) {
  const matches = text.match(/\b(\d+(?:\s*[a-z])?\s*§)/g) || [];
  const unique = new Set(matches.map(m => m.replace(/\s+/g, ' ').trim()));
  const list = [...unique].sort((a, b) => parseInt(a) - parseInt(b));
  const nums = list.map(s => parseInt(s)).filter(n => !isNaN(n));
  const lastNum = nums.length > 0 ? Math.max(...nums) : 0;
  return { unique: unique.size, lastNum, total: matches.length };
}

async function run() {
  const { extractText } = await import('unpdf');

  // Get all DB entries, sum up chapter § counts per parent doc
  const docs = await p.legalDocument.findMany({
    where: { document_number: { startsWith: 'AFS 2023:' } },
    select: { document_number: true, full_text: true },
    orderBy: { document_number: 'asc' }
  });

  // Build DB totals per parent document (combine parent + chapters)
  const dbTotals = {};
  for (const d of docs) {
    const parentNum = d.document_number.split(' kap.')[0];
    if (!dbTotals[parentNum]) dbTotals[parentNum] = { uniqueSet: new Set(), totalRefs: 0, entries: 0 };

    const ft = d.full_text || '';
    const matches = ft.match(/\b(\d+(?:\s*[a-z])?\s*§)/g) || [];
    for (const m of matches) {
      dbTotals[parentNum].uniqueSet.add(m.replace(/\s+/g, ' ').trim());
    }
    dbTotals[parentNum].totalRefs += matches.length;
    dbTotals[parentNum].entries++;
  }

  // Get PDF stats
  const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf')).sort();

  console.log('Document'.padEnd(16), 'Pages'.padEnd(7), 'PDF §'.padEnd(8), 'DB §'.padEnd(8), 'DB refs'.padEnd(9), 'PDF refs'.padEnd(10), 'Entries'.padEnd(9), 'Status');
  console.log('='.repeat(90));

  for (const file of files) {
    const filePath = path.join(PDF_DIR, file);
    const buffer = fs.readFileSync(filePath);
    const data = new Uint8Array(buffer);

    const result = await extractText(data, { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join('\n') : result.text;
    const pages = result.totalPages || 0;
    const pdfStats = countParagraphs(text);

    const docNum = file.replace('.pdf', '').replace('AFS-', 'AFS ').replace(/-/g, ':');
    const db = dbTotals[docNum];

    if (!db) {
      console.log(
        docNum.padEnd(16),
        String(pages).padEnd(7),
        String(pdfStats.unique).padEnd(8),
        '-'.padEnd(8),
        '-'.padEnd(9),
        String(pdfStats.total).padEnd(10),
        '-'.padEnd(9),
        'NOT IN DB'
      );
      continue;
    }

    const dbUnique = db.uniqueSet.size;
    const ratio = pdfStats.unique > 0 ? (dbUnique / pdfStats.unique * 100).toFixed(0) : '-';
    let status = '';
    if (dbUnique >= pdfStats.unique * 0.85) {
      status = 'OK';
    } else if (dbUnique >= pdfStats.unique * 0.5) {
      status = 'PARTIAL (' + ratio + '%)';
    } else {
      status = 'INCOMPLETE (' + ratio + '%)';
    }

    // Special check: PDF has many more unique § than DB
    if (pdfStats.unique > dbUnique + 5) {
      status += ' [missing ~' + (pdfStats.unique - dbUnique) + ' §]';
    }

    console.log(
      docNum.padEnd(16),
      String(pages).padEnd(7),
      String(pdfStats.unique).padEnd(8),
      String(dbUnique).padEnd(8),
      String(db.totalRefs).padEnd(9),
      String(pdfStats.total).padEnd(10),
      String(db.entries).padEnd(9),
      status
    );
  }

  await p.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
