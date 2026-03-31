#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Story 17.7: Seed Document Templates
 *
 * Seeds 5 initial Swedish compliance document templates into
 * WorkspaceDocumentTemplate. Uses deterministic UUIDs for idempotent upserts.
 *
 * Usage:
 *   npx tsx scripts/seed-document-templates.ts
 *   npx tsx scripts/seed-document-templates.ts --dry-run
 *   npx tsx scripts/seed-document-templates.ts --force
 */

import { PrismaClient } from '@prisma/client'
import { resolve } from 'node:path'
import { config } from 'dotenv'

config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

// Parse CLI flags
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')

// Import template definitions
// Using dynamic import since this is a script, not a Next.js module
async function loadTemplates() {
  const { TEMPLATES } = await import('../lib/documents/template-content')
  return TEMPLATES
}

async function main() {
  console.log('🗃️  Seeding document templates...')
  if (dryRun) console.log('  (dry-run mode — no database writes)')
  if (force) console.log('  (force mode — overwrite existing)')

  const templates = await loadTemplates()

  let created = 0
  let updated = 0
  let skipped = 0

  for (const template of templates) {
    const existing = await prisma.workspaceDocumentTemplate.findUnique({
      where: { id: template.id },
      select: { id: true, name: true },
    })

    if (existing && !force) {
      console.log(
        `  ⏭️  Skip: ${template.name} (already exists, use --force to update)`
      )
      skipped++
      continue
    }

    if (dryRun) {
      console.log(
        `  📝 Would ${existing ? 'update' : 'create'}: ${template.name} (${template.documentType})`
      )
      if (existing) {
        updated++
      } else {
        created++
      }
      continue
    }

    await prisma.workspaceDocumentTemplate.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        description: template.description,
        document_type: template.documentType as never,
        content_json: template.content as never,
        is_active: true,
        sort_order: template.sortOrder,
      },
      create: {
        id: template.id,
        name: template.name,
        description: template.description,
        document_type: template.documentType as never,
        content_json: template.content as never,
        is_active: true,
        sort_order: template.sortOrder,
      },
    })

    if (existing) {
      console.log(`  ✏️  Updated: ${template.name}`)
      updated++
    } else {
      console.log(`  ✅ Created: ${template.name}`)
      created++
    }
  }

  console.log(
    `\n📊 Summary: ${created} created, ${updated} updated, ${skipped} skipped`
  )
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
