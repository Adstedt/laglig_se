/**
 * Debug script: inspect TreDoffice workspace state vs working workspaces.
 * Active workspace cookie: 6adbf0f4-21a0-4bd1-ae2b-e46f4a749d53
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TARGET_ID = '6adbf0f4-21a0-4bd1-ae2b-e46f4a749d53'

async function main() {
  // TreDoffice full state
  const tre = await prisma.workspace.findUnique({
    where: { id: 'a7acf350-091b-42fd-9006-0cefa33cc22d' },
    select: {
      id: true,
      name: true,
      subscription_tier: true,
      trial_picked_tier: true,
      stripe_subscription_id: true,
      stripe_customer_id: true,
      status: true,
      trial_ends_at: true,
    },
  })
  console.log('--- TreDoffice STATE ---')
  console.log(JSON.stringify(tre, null, 2))

  const ws = await prisma.workspace.findUnique({
    where: { id: TARGET_ID },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      subscription_tier: true,
      trial_picked_tier: true,
      trial_ends_at: true,
      stripe_subscription_id: true,
      stripe_customer_id: true,
      payment_grace_period_ends_at: true,
      created_at: true,
    },
  })
  console.log('--- TARGET WORKSPACE ---')
  console.log(JSON.stringify(ws, null, 2))

  if (ws) {
    const profile = await prisma.companyProfile.findFirst({
      where: { workspace_id: ws.id },
      select: {
        company_name: true,
        org_number: true,
        industry_label: true,
        sni_code: true,
      },
    })
    console.log('\n--- COMPANY PROFILE ---')
    console.log(profile ? JSON.stringify(profile, null, 2) : 'NONE')

    const usage = await prisma.workspaceUsage.findUnique({
      where: { workspace_id: ws.id },
    })
    console.log('\n--- WORKSPACE USAGE ---')
    if (usage) {
      console.log({
        workspace_id: usage.workspace_id,
        tokens_used_this_period: usage.tokens_used_this_period.toString(),
        period_started_at: usage.period_started_at,
      })
    } else {
      console.log('NONE')
    }

    const memberCount = await prisma.workspaceMember.count({
      where: { workspace_id: ws.id },
    })
    console.log('\n--- MEMBER COUNT ---', memberCount)
  }

  // Compare against a known-working tier sample
  console.log('\n--- ALL WORKSPACES SUMMARY ---')
  const all = await prisma.workspace.findMany({
    select: {
      id: true,
      name: true,
      subscription_tier: true,
      trial_picked_tier: true,
      status: true,
      trial_ends_at: true,
      stripe_subscription_id: true,
    },
    orderBy: { created_at: 'desc' },
    take: 30,
  })
  for (const w of all) {
    const marker = w.id === TARGET_ID ? '>>>' : '   '
    console.log(
      `${marker} ${w.name.padEnd(30)} | tier=${w.subscription_tier} | picked=${w.trial_picked_tier ?? '-'} | trial_ends=${w.trial_ends_at?.toISOString() ?? '-'} | sub=${w.stripe_subscription_id ? 'Y' : 'N'} | status=${w.status}`
    )
  }
}

main()
  .catch((err) => {
    console.error('FATAL:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
