import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

async function main() {
  // Get actual storage_path from DB
  const amendment = await prisma.amendmentDocument.findFirst({
    where: { sfs_number: 'SFS 2025:1' },
    select: { sfs_number: true, storage_path: true },
  })

  console.log('Amendment from DB:')
  console.log('  sfs_number:', amendment?.sfs_number)
  console.log('  storage_path:', amendment?.storage_path)

  if (amendment?.storage_path) {
    // Try to download using the actual storage path
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('\nTrying to download from:', amendment.storage_path)
    const { data, error } = await client.storage
      .from('sfs-pdfs')
      .download(amendment.storage_path)

    if (error) {
      console.log('Error:', error.message)
    } else if (data) {
      const buffer = Buffer.from(await data.arrayBuffer())
      console.log('Success! Got', buffer.length, 'bytes')
    }
  }

  // Also test what the getStoragePath function would generate
  console.log('\n--- Testing getStoragePath logic ---')
  const sfsNumber = '2025:1'
  const [year, num] = sfsNumber.split(':')
  const generatedPath = `${year}/SFS${year}-${num}.pdf`
  console.log('For sfsNumber:', sfsNumber)
  console.log('Generated path:', generatedPath)

  await prisma.$disconnect()
}
main()
