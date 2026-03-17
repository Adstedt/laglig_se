import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const withPrefix = await p.contentChunk.count({
    where: { context_prefix: { not: null } },
  })
  console.log('Chunks with context_prefix:', withPrefix)

  const withPrefixAndEmbed = await p.$queryRawUnsafe(
    'SELECT COUNT(*) as count FROM content_chunks WHERE context_prefix IS NOT NULL AND embedding IS NOT NULL'
  )
  console.log('With prefix + embedding:', withPrefixAndEmbed)

  const withPrefixNoEmbed = await p.$queryRawUnsafe(
    'SELECT COUNT(*) as count FROM content_chunks WHERE context_prefix IS NOT NULL AND embedding IS NULL'
  )
  console.log('With prefix, no embedding:', withPrefixNoEmbed)

  await p.$disconnect()
}

main()
