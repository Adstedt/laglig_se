import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const w = await p.contentChunk.count({
    where: { context_prefix: { not: null } },
  })
  const t = await p.contentChunk.count()
  console.log(`total=${t} withPrefix=${w} without=${t - w}`)
  await p.$disconnect()
}
main()
