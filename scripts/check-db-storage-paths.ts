import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

async function main() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Sample storage_path from different years in DB
  const years = ['1998', '2010', '2020', '2025']

  for (const year of years) {
    const amendment = await prisma.amendmentDocument.findFirst({
      where: {
        parse_status: 'COMPLETED',
        sfs_number: { startsWith: `SFS ${year}:` }
      },
      select: { sfs_number: true, storage_path: true }
    })

    if (amendment) {
      console.log(`\n=== ${year} ===`)
      console.log('DB sfs_number:', amendment.sfs_number)
      console.log('DB storage_path:', amendment.storage_path)

      // Try downloading using DB storage_path directly
      if (amendment.storage_path) {
        const { data, error } = await client.storage
          .from('sfs-pdfs')
          .download(amendment.storage_path)

        if (error) {
          console.log('Download with DB path: FAILED -', error.message || 'empty error')

          // Try with different path patterns
          const patterns = [
            amendment.storage_path,
            `SFS ${amendment.storage_path.split('/')[0]}/${amendment.storage_path.split('/')[1]}`,
            `SFS ${year}/${amendment.storage_path.split('/')[1]}`,
            `SFS ${year}/SFS${amendment.storage_path.split('/')[1]?.replace('SFS', '')}`,
          ]

          for (const pattern of patterns) {
            const { data: d2, error: e2 } = await client.storage
              .from('sfs-pdfs')
              .download(pattern)

            if (!e2 && d2) {
              const bytes = (await d2.arrayBuffer()).byteLength
              console.log(`Found with pattern: "${pattern}" (${bytes} bytes)`)
              break
            }
          }
        } else if (data) {
          console.log('Download with DB path: SUCCESS -', (await data.arrayBuffer()).byteLength, 'bytes')
        }
      }
    }
  }

  await prisma.$disconnect()
}
main()
