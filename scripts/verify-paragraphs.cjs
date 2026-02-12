#!/usr/bin/env node
/**
 * Verification script: Compare § counts between PDFs and DB entries
 * Counts unique paragraf (§) numbers in each document/chapter
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const p = new PrismaClient();

// Count unique § numbers in text
function countParagraphs(text) {
  // Match patterns like '1 §', '2 §', '17 a §', '3 b §' etc.
  const matches = text.match(/\b(\d+(?:\s*[a-z])?\s*§)/g) || [];
  const unique = new Set(matches.map(m => m.replace(/\s+/g, ' ').trim()));
  const list = [...unique].sort((a, b) => parseInt(a) - parseInt(b));
  const nums = list.map(s => parseInt(s)).filter(n => !isNaN(n));
  const lastNum = nums.length > 0 ? Math.max(...nums) : 0;
  return { total: matches.length, unique: unique.size, lastNum, list };
}

async function run() {
  const docs = await p.legalDocument.findMany({
    where: { document_number: { startsWith: 'AFS 2023:' } },
    select: { document_number: true, full_text: true, markdown_content: true },
    orderBy: { document_number: 'asc' }
  });

  console.log('Document Number'.padEnd(30), 'Unique §'.padEnd(10), 'Highest §'.padEnd(12), 'Total refs'.padEnd(12), 'Content len');
  console.log('='.repeat(80));

  let currentParent = '';
  for (const d of docs) {
    const ft = d.full_text || '';
    const stats = countParagraphs(ft);

    // Visual grouping for split docs
    const isChapter = d.document_number.includes('kap.');
    const parentNum = d.document_number.split(' kap.')[0];
    if (!isChapter && parentNum !== currentParent) {
      if (currentParent) console.log();
      currentParent = parentNum;
    }

    const prefix = isChapter ? '  ' : '';
    console.log(
      (prefix + d.document_number).padEnd(30),
      String(stats.unique).padEnd(10),
      String(stats.lastNum || '-').padEnd(12),
      String(stats.total).padEnd(12),
      ft.length
    );
  }

  await p.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
