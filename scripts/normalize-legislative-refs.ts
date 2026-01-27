/**
 * Normalize legislative_refs.reference to canonical Swedish format
 * Story 2.29: Ensures consistent format for display and deduplication
 *
 * Canonical formats:
 * - "Prop. 2024/25:59" (not "prop." or "PROP.")
 * - "Bet. 2024/25:JuU18" (not "bet." or "BET.")
 * - "Rskr. 2024/25:150" (not "rskr." or "RSKR.")
 * - "SOU 2024:15"
 * - "Ds 2024:15"
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient, LegislativeRefType } from '@prisma/client'

const prisma = new PrismaClient()

const CANONICAL_PREFIX: Record<LegislativeRefType, string> = {
  PROP: 'Prop.',
  BET: 'Bet.',
  RSKR: 'Rskr.',
  SOU: 'SOU',
  DS: 'Ds',
}

async function main() {
  console.log('=== Normalizing Legislative References ===\n')

  // Get all refs
  const refs = await prisma.legislativeRef.findMany({
    select: {
      id: true,
      ref_type: true,
      reference: true,
      year: true,
      number: true,
    },
  })

  console.log(`Found ${refs.length} references to check\n`)

  let updatedCount = 0
  const updates: { id: string; oldRef: string; newRef: string }[] = []

  for (const ref of refs) {
    // Build canonical reference: "Prop. 2024/25:59"
    const canonicalRef = `${CANONICAL_PREFIX[ref.ref_type]} ${ref.year}:${ref.number}`

    if (ref.reference !== canonicalRef) {
      updates.push({
        id: ref.id,
        oldRef: ref.reference,
        newRef: canonicalRef,
      })
    }
  }

  if (updates.length === 0) {
    console.log('✓ All references are already normalized!')
    return
  }

  console.log(`Found ${updates.length} references to normalize:\n`)

  // Show sample of changes
  const samples = updates.slice(0, 10)
  for (const u of samples) {
    console.log(`  "${u.oldRef}" → "${u.newRef}"`)
  }
  if (updates.length > 10) {
    console.log(`  ... and ${updates.length - 10} more\n`)
  }

  // Apply updates
  console.log('\nApplying updates...')

  for (const u of updates) {
    await prisma.legislativeRef.update({
      where: { id: u.id },
      data: { reference: u.newRef },
    })
    updatedCount++
  }

  console.log(`\n✓ Updated ${updatedCount} references`)

  // Verify uniqueness
  const byRef = await prisma.legislativeRef.groupBy({
    by: ['reference'],
    _count: { id: true },
  })

  console.log(`\n=== Verification ===`)
  console.log(`Unique references: ${byRef.length}`)

  // Show unique props
  const uniqueProps = await prisma.legislativeRef.findMany({
    where: { ref_type: 'PROP' },
    distinct: ['reference'],
    select: { reference: true },
    orderBy: { reference: 'asc' },
  })

  console.log(`\nUnique Propositions (${uniqueProps.length}):`)
  uniqueProps.forEach((p) => console.log(`  ${p.reference}`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
