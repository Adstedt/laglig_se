/**
 * Check actual content differences beyond formatting
 */
import { PrismaClient } from '@prisma/client'
import {
  cleanLineBreakHyphens,
  removeSoftHyphens,
} from '../lib/utils/text-cleanup'

const prisma = new PrismaClient()

function normalizeForCompare(text: string): string {
  let n = removeSoftHyphens(text)
  n = cleanLineBreakHyphens(n)
  return n
    .replace(/\r\n/g, '\n')
    .replace(/\d+\s*[a-z]?\s*§\s*/gi, '')
    .replace(/\d+\s*kap\.\s*/gi, '')
    .replace(/§/g, '')
    .replace(/\.?\s*Lag\s*\(\d{4}:\d+\)/gi, '')
    .replace(/SFS\s*\d{4}:\d+/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim()
    .replace(/\.\s*$/, '')
}

async function main() {
  const baseLawSfs = 'SFS 1977:1160'

  console.log('=== Checking Actual Content Differences ===\n')

  // Get current LawSection for 1:4
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: { contains: baseLawSfs } },
  })
  const currentSection = await prisma.lawSection.findFirst({
    where: { legal_document_id: doc?.id, chapter: '1', section: '4' },
  })

  // Get oldest and newest amendment text
  const changes = await prisma.sectionChange.findMany({
    where: {
      chapter: '1',
      section: '4',
      amendment: { base_law_sfs: baseLawSfs },
      new_text: { not: null },
    },
    include: {
      amendment: { select: { sfs_number: true, effective_date: true } },
    },
    orderBy: { amendment: { effective_date: 'asc' } },
  })

  const oldest = changes[0]
  const newest = changes[changes.length - 1]

  console.log('Current LawSection (raw):')
  console.log(currentSection?.text_content)
  console.log('\n---')

  console.log('\nOldest amendment with text:', oldest?.amendment.sfs_number)
  console.log(oldest?.new_text)
  console.log('\n---')

  console.log('\nNewest amendment with text:', newest?.amendment.sfs_number)
  console.log(newest?.new_text)
  console.log('\n---')

  // Compare normalized versions
  const currentNorm = normalizeForCompare(currentSection?.text_content || '')
  const oldestNorm = normalizeForCompare(oldest?.new_text || '')
  const newestNorm = normalizeForCompare(newest?.new_text || '')

  console.log('\n=== Normalized comparison ===')
  console.log('Current == Oldest?', currentNorm === oldestNorm)
  console.log('Current == Newest?', currentNorm === newestNorm)
  console.log('Oldest == Newest?', oldestNorm === newestNorm)

  // Show character differences
  if (oldestNorm !== newestNorm) {
    console.log('\n=== Oldest vs Newest (first difference) ===')
    for (let i = 0; i < Math.max(oldestNorm.length, newestNorm.length); i++) {
      if (oldestNorm[i] !== newestNorm[i]) {
        console.log(`Position ${i}:`)
        console.log(
          `  Oldest: ...${oldestNorm.substring(Math.max(0, i - 20), i + 50)}...`
        )
        console.log(
          `  Newest: ...${newestNorm.substring(Math.max(0, i - 20), i + 50)}...`
        )
        break
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
