/* eslint-disable no-console */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { prisma } from '@/lib/prisma'

async function main() {
  const ws = await prisma.workspace.findFirst({
    where: { name: { contains: 'Almåsa' } },
    select: { id: true, name: true, created_at: true },
  })
  if (!ws) {
    console.log('not found')
    return
  }
  const ageMs = Date.now() - ws.created_at.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  console.log(
    JSON.stringify(
      {
        name: ws.name,
        created_at: ws.created_at.toISOString(),
        age_hours: ageHours.toFixed(1),
        fresh_24h: ageHours <= 24,
      },
      null,
      2
    )
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
