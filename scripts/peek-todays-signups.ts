import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const startOfTodayLocal = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  )
  const startOfYesterdayLocal = new Date(startOfTodayLocal)
  startOfYesterdayLocal.setDate(startOfYesterdayLocal.getDate() - 1)
  const startOf7dAgo = new Date(startOfTodayLocal)
  startOf7dAgo.setDate(startOf7dAgo.getDate() - 7)

  const fmt = (d: Date) =>
    d.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })

  console.log(`Now (local): ${fmt(now)}`)
  console.log(`Window: workspaces created since ${fmt(startOfTodayLocal)}\n`)

  const todays = await prisma.workspace.findMany({
    where: { created_at: { gte: startOfTodayLocal } },
    orderBy: { created_at: 'desc' },
    include: {
      owner: { select: { email: true, name: true } },
      _count: { select: { members: true } },
    },
  })

  console.log(`=== Today's new workspaces: ${todays.length} ===`)
  for (const w of todays) {
    console.log(
      `• ${fmt(w.created_at)}  ${w.name}  (slug=${w.slug})\n` +
        `    owner: ${w.owner.email}${w.owner.name ? ` (${w.owner.name})` : ''}\n` +
        `    tier: ${w.subscription_tier}  status: ${w.status}  picked: ${w.trial_picked_tier ?? '—'}  members: ${w._count.members}\n` +
        `    org: ${w.company_legal_name ?? '—'} (${w.org_number ?? 'no org#'})  law-list-gen: ${w.law_list_generation_status ?? 'null'}`
    )
  }

  const yesterdayCount = await prisma.workspace.count({
    where: {
      created_at: { gte: startOfYesterdayLocal, lt: startOfTodayLocal },
    },
  })
  const last7Count = await prisma.workspace.count({
    where: { created_at: { gte: startOf7dAgo } },
  })
  const allTime = await prisma.workspace.count()

  console.log(`\n=== Context ===`)
  console.log(`Yesterday: ${yesterdayCount}`)
  console.log(`Last 7 days (incl. today): ${last7Count}`)
  console.log(`All-time workspaces: ${allTime}`)

  // Also peek at users created today (signup ≠ workspace creation in some flows)
  const newUsersToday = await prisma.user.count({
    where: { created_at: { gte: startOfTodayLocal } },
  })
  console.log(`New users today: ${newUsersToday}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
