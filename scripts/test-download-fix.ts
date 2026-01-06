import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { downloadPdfByPath } from '../lib/supabase/storage'

const prisma = new PrismaClient()

async function main() {
  // Test downloading a 2025 amendment (was failing before)
  const amendment2025 = await prisma.amendmentDocument.findFirst({
    where: { sfs_number: 'SFS 2025:1' },
    select: { sfs_number: true, storage_path: true }
  })

  console.log('Testing 2025 amendment:')
  console.log('  sfs_number:', amendment2025?.sfs_number)
  console.log('  storage_path:', amendment2025?.storage_path)

  if (amendment2025?.storage_path) {
    const pdf = await downloadPdfByPath(amendment2025.storage_path)
    console.log('  Download result:', pdf ? `SUCCESS (${pdf.length} bytes)` : 'FAILED')
  }

  // Test downloading a 1998 amendment (was working before)
  const amendment1998 = await prisma.amendmentDocument.findFirst({
    where: { sfs_number: { startsWith: 'SFS 1998:' } },
    select: { sfs_number: true, storage_path: true }
  })

  console.log('\nTesting 1998 amendment:')
  console.log('  sfs_number:', amendment1998?.sfs_number)
  console.log('  storage_path:', amendment1998?.storage_path)

  if (amendment1998?.storage_path) {
    const pdf = await downloadPdfByPath(amendment1998.storage_path)
    console.log('  Download result:', pdf ? `SUCCESS (${pdf.length} bytes)` : 'FAILED')
  }

  await prisma.$disconnect()
}
main()
