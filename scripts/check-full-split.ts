import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Check AmendmentDocument titles
  const amendments = await prisma.amendmentDocument.findMany({
    select: { title: true },
  })

  let lagar = 0
  let forordningar = 0
  let other = 0

  for (const a of amendments) {
    const title = (a.title || '').toLowerCase()
    if (title.includes('lag (') || title.includes('lag om')) {
      lagar++
    } else if (title.includes('förordning')) {
      forordningar++
    } else {
      other++
    }
  }

  const total = amendments.length
  console.log('Full amendment corpus split:')
  console.log('  Total:', total)
  console.log(
    '  Lagar (laws):',
    lagar,
    `(${((lagar / total) * 100).toFixed(1)}%)`
  )
  console.log(
    '  Förordningar (regulations):',
    forordningar,
    `(${((forordningar / total) * 100).toFixed(1)}%)`
  )
  console.log('  Other:', other, `(${((other / total) * 100).toFixed(1)}%)`)
  console.log('')
  console.log('Expected prop/bet/rskr refs after full batch:', lagar)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
