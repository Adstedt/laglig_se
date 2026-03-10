#!/usr/bin/env npx tsx
/* eslint-disable no-console */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import * as fs from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: { html_content: true },
  })

  if (!doc?.html_content) {
    console.log('Not found')
    return
  }

  // Save raw HTML for inspection
  fs.writeFileSync(
    'data/canonical-review/debug-sfs-raw.html',
    doc.html_content,
    'utf-8'
  )
  console.log(`Raw HTML: ${doc.html_content.length} chars`)

  // Show first 3000 chars to understand structure
  console.log('\n=== FIRST 3000 CHARS ===\n')
  console.log(doc.html_content.slice(0, 3000))

  // Show key patterns
  console.log('\n=== PATTERN COUNTS ===')
  console.log(
    `<a name="K  : ${(doc.html_content.match(/<a name="K/g) || []).length}`
  )
  console.log(
    `<a class="paragraf": ${(doc.html_content.match(/<a class="paragraf"/g) || []).length}`
  )
  console.log(`<h3>       : ${(doc.html_content.match(/<h3>/g) || []).length}`)
  console.log(
    `<h3 class  : ${(doc.html_content.match(/<h3 class/g) || []).length}`
  )
  console.log(`<p>        : ${(doc.html_content.match(/<p>/g) || []).length}`)
  console.log(
    `<p class   : ${(doc.html_content.match(/<p class/g) || []).length}`
  )
  console.log(
    `class="Led : ${(doc.html_content.match(/class="Led/g) || []).length}`
  )
  console.log(`<b>        : ${(doc.html_content.match(/<b>/g) || []).length}`)
  console.log(
    `overgang   : ${(doc.html_content.match(/overgang/gi) || []).length}`
  )
  console.log(`§          : ${(doc.html_content.match(/§/g) || []).length}`)
  console.log(`kap.       : ${(doc.html_content.match(/kap\./g) || []).length}`)
  console.log(
    `<article   : ${(doc.html_content.match(/<article/g) || []).length}`
  )
  console.log(
    `legal-document: ${(doc.html_content.match(/legal-document/g) || []).length}`
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
