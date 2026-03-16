import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const r = await p.$queryRawUnsafe<{ indexname: string }[]>(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'content_chunks'"
  )
  console.log(
    'Indexes:',
    r.map((i) => i.indexname)
  )
  const invalid = await p.$queryRawUnsafe<{ indexname: string }[]>(
    'SELECT indexrelid::regclass as indexname FROM pg_index WHERE NOT indisvalid'
  )
  console.log(
    'Invalid indexes:',
    invalid.map((i) => i.indexname)
  )
  await p.$disconnect()
}
main()
