#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const p = new PrismaClient();

async function run() {
  const doc = await p.legalDocument.findUnique({
    where: { document_number: 'AFS 2023:3' },
    select: { html_content: true, title: true },
  });

  if (!doc || !doc.html_content) {
    console.error('AFS 2023:3 not found or has no HTML content');
    process.exit(1);
  }

  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>${doc.title} — AFS 2023:3</title>
  <style>
    body { font-family: Georgia, serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 1.5rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { font-size: 1.3rem; margin-top: 2rem; color: #222; }
    h3 { font-size: 1.1rem; margin-top: 1.5rem; color: #333; }
    section { margin: 1rem 0; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.8rem; text-align: left; }
    th { background: #f5f5f5; }
    .kapitel { border-left: 3px solid #0066cc; padding-left: 1rem; margin: 2rem 0; }
    article { background: #fafafa; padding: 1rem; border: 1px solid #e0e0e0; border-radius: 4px; }
  </style>
</head>
<body>
${doc.html_content}
</body>
</html>`;

  const outPath = path.resolve(__dirname, '../data/afs-2023-3-review.html');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`Written to: ${outPath}`);
  console.log(`HTML content length: ${doc.html_content.length} chars`);
  await p.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
