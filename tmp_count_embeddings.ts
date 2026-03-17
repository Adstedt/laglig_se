import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const result = await p.$queryRawUnsafe(`
    SELECT
      COUNT(*) as total,
      COUNT(embedding) as with_embedding,
      COUNT(*) - COUNT(embedding) as without_embedding,
      COUNT(context_prefix) as with_prefix
    FROM content_chunks
  `)
  console.log(result)
  await p.$disconnect()
}

main()
