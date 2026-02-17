#!/usr/bin/env npx tsx
/**
 * Export generated summaries and kommentars for review.
 * Outputs a markdown file grouped by authority.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'node:url'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  // Read document numbers from the template list
  const allDocNumbers = readFileSync(
    'data/template-docs-needing-ai.txt',
    'utf-8'
  )
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  // Also include the 7 docs that already had content before Pass 2
  const preExisting = [
    'SFS 1977:1160',
    'SFS 1982:673',
    'SFS 1995:1554',
    'SFS 1998:808',
    'SFS 1999:381',
    'SFS 2008:567',
    'SFS 2010:1011',
  ]

  const docNumbers = [...new Set([...allDocNumbers, ...preExisting])]

  const docs = await prisma.legalDocument.findMany({
    where: { document_number: { in: docNumbers } },
    select: {
      document_number: true,
      title: true,
      summary: true,
      kommentar: true,
      summering_generated_by: true,
      kommentar_generated_by: true,
    },
    orderBy: { document_number: 'asc' },
  })

  // Group by authority prefix
  const groups = new Map<string, typeof docs>()
  for (const doc of docs) {
    const prefix = getAuthorityPrefix(doc.document_number)
    if (!groups.has(prefix)) groups.set(prefix, [])
    groups.get(prefix)!.push(doc)
  }

  // Build markdown
  const lines: string[] = [
    '# Content Review: Generated Summaries & Kommentars',
    '',
    `Generated: ${new Date().toISOString().split('T')[0]}`,
    `Total documents: ${docs.length}`,
    '',
    '---',
    '',
  ]

  const authorityOrder = [
    'SFS',
    'AFS',
    'MSBFS',
    'NFS',
    'ELSÄK-FS',
    'KIFS',
    'BFS',
    'SRVFS',
    'SKVFS',
    'SCB-FS',
    'SSMFS',
    'STAFS',
  ]

  for (const authority of authorityOrder) {
    const groupDocs = groups.get(authority)
    if (!groupDocs || groupDocs.length === 0) continue

    lines.push(`## ${authority} (${groupDocs.length} documents)`)
    lines.push('')

    for (const doc of groupDocs) {
      lines.push(`### ${doc.document_number}`)
      lines.push('')
      if (doc.title) {
        lines.push(`**${doc.title}**`)
        lines.push('')
      }
      if (doc.summering_generated_by) {
        lines.push(`*Model: ${doc.summering_generated_by}*`)
        lines.push('')
      }

      lines.push('#### Summering')
      lines.push('')
      lines.push(doc.summary ?? '*— saknas —*')
      lines.push('')

      lines.push('#### Kommentar')
      lines.push('')
      lines.push(doc.kommentar ?? '*— saknas —*')
      lines.push('')
      lines.push('---')
      lines.push('')
    }
  }

  const outPath = 'data/content-review.md'
  writeFileSync(outPath, lines.join('\n'), 'utf-8')
  console.log(`Exported ${docs.length} documents to ${outPath}`)

  await prisma.$disconnect()
}

function getAuthorityPrefix(docNumber: string): string {
  if (docNumber.startsWith('SFS')) return 'SFS'
  if (docNumber.startsWith('AFS')) return 'AFS'
  if (docNumber.startsWith('MSBFS')) return 'MSBFS'
  if (docNumber.startsWith('NFS')) return 'NFS'
  if (docNumber.startsWith('ELSÄK-FS')) return 'ELSÄK-FS'
  if (docNumber.startsWith('KIFS')) return 'KIFS'
  if (docNumber.startsWith('BFS')) return 'BFS'
  if (docNumber.startsWith('SRVFS')) return 'SRVFS'
  if (docNumber.startsWith('SKVFS')) return 'SKVFS'
  if (docNumber.startsWith('SCB-FS')) return 'SCB-FS'
  if (docNumber.startsWith('SSMFS')) return 'SSMFS'
  if (docNumber.startsWith('STAFS')) return 'STAFS'
  return 'OTHER'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error)
}
