import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const count = await p.changeEvent.count()
  console.log('changeEvent count:', count)

  if (count > 0) {
    const event = await p.changeEvent.findFirst({
      select: { id: true, change_type: true, amendment_sfs: true },
      orderBy: { detected_at: 'desc' },
    })
    console.log('Latest event:', JSON.stringify(event, null, 2))
  }

  await p.$disconnect()
}

main()
