import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const indexes = await p.$queryRawUnsafe(
    "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'content_chunks'"
  )
  console.log(JSON.stringify(indexes, null, 2))
  await p.$disconnect()
}

main()
