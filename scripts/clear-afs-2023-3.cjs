#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const result = await p.legalDocument.delete({
    where: { document_number: 'AFS 2023:3' },
  });
  console.log('Deleted:', result.document_number);
  await p.$disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
