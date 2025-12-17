/**
 * Verify LLM parsing quality by examining specific cases
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get one of the 'LLM found more' cases
  const doc = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: 'SFS 2018:1026' },
    select: {
      sfs_number: true,
      full_text: true,
      section_changes: {
        select: {
          chapter: true,
          section: true,
          change_type: true,
          new_text: true,
        },
        orderBy: { sort_order: 'asc' },
      },
    },
  })

  console.log('SFS:', doc?.sfs_number)
  console.log('\nFull text (first 1500 chars):')
  console.log(doc?.full_text?.substring(0, 1500))
  console.log('\n---\n\nLLM parsed sections:')
  doc?.section_changes.forEach((c) => {
    const ch = c.chapter ? c.chapter + ' kap. ' : ''
    console.log('  ' + ch + c.section + ' § - ' + c.change_type)
    if (c.new_text) {
      console.log('    new_text (first 100): ' + c.new_text.substring(0, 100))
    }
  })

  await prisma.$disconnect()
}

main().catch(console.error)
