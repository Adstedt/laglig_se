import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const result = await p.changeEvent.updateMany({
    where: { notification_sent: false },
    data: { notification_sent: true },
  })
  console.log('Marked', result.count, 'ChangeEvents as notification_sent=true')

  const unsent = await p.changeEvent.count({
    where: { notification_sent: false },
  })
  console.log('Remaining unsent:', unsent)
  await p.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
