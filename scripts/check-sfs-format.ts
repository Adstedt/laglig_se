import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { downloadPdf, getStoragePath } from '../lib/supabase/storage'

const prisma = new PrismaClient()

async function main() {
  // Get a few amendments
  const amendments = await prisma.amendmentDocument.findMany({
    where: { parse_status: 'COMPLETED' },
    select: { sfs_number: true, storage_path: true },
    take: 3,
    orderBy: { sfs_number: 'desc' },
  })

  for (const a of amendments) {
    console.log('DB sfs_number:', a.sfs_number)
    console.log('DB storage_path:', a.storage_path)
    console.log('Calculated path:', getStoragePath(a.sfs_number))

    // Try download
    const pdf = await downloadPdf(a.sfs_number)
    console.log('Download result:', pdf ? `${pdf.length} bytes` : 'FAILED')
    console.log('')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
