import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { downloadPdf } from '../lib/supabase/storage'

const prisma = new PrismaClient()

async function main() {
  const amendments = await prisma.amendmentDocument.findMany({
    where: {
      parse_status: 'COMPLETED',
      sfs_number: { startsWith: '2025:' }
    },
    select: { sfs_number: true, storage_path: true },
    orderBy: { sfs_number: 'asc' },
    take: 10
  })

  console.log('Sample 2025 amendments:')
  for (const a of amendments) {
    console.log(a.sfs_number, '->', a.storage_path)
  }

  console.log('\nTrying to download first one...')
  if (amendments[0]) {
    const pdf = await downloadPdf(amendments[0].sfs_number)
    console.log('Result:', pdf ? `Got ${pdf.length} bytes` : 'FAILED')
  }

  await prisma.$disconnect()
}
main()
