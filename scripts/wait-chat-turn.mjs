import { PrismaClient } from '@prisma/client'

const baseline = parseInt(process.argv[2] || '0', 10)
const timeoutMs = parseInt(process.argv[3] || '120000', 10)
const p = new PrismaClient()
const start = Date.now()

while (Date.now() - start < timeoutMs) {
  const c = await p.chatUsageEvent.count()
  if (c > baseline) {
    console.log(
      JSON.stringify({ done: true, count: c, elapsedMs: Date.now() - start })
    )
    await p.$disconnect()
    process.exit(0)
  }
  await new Promise((r) => setTimeout(r, 2000))
}

console.log(
  JSON.stringify({
    done: false,
    timeout: true,
    count: await p.chatUsageEvent.count(),
  })
)
await p.$disconnect()
process.exit(1)
