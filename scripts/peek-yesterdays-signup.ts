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

  const fmt = (d: Date | null) =>
    d ? d.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }) : '—'

  const yesterdays = await prisma.workspace.findMany({
    where: {
      created_at: { gte: startOfYesterdayLocal, lt: startOfTodayLocal },
    },
    orderBy: { created_at: 'desc' },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          name: true,
          created_at: true,
          last_login_at: true,
          email_verified: true,
        },
      },
      _count: {
        select: {
          members: true,
          invitations: true,
          law_lists: true,
          onboarding_events: true,
        },
      },
    },
  })

  for (const w of yesterdays) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Workspace: ${w.name}  (slug=${w.slug})`)
    console.log(`  id:         ${w.id}`)
    console.log(`  created:    ${fmt(w.created_at)}`)
    console.log(`  updated:    ${fmt(w.updated_at)}`)
    console.log(``)
    console.log(`  Owner:`)
    console.log(`    email:        ${w.owner.email}`)
    console.log(`    name:         ${w.owner.name ?? '—'}`)
    console.log(`    verified:     ${w.owner.email_verified}`)
    console.log(`    user created: ${fmt(w.owner.created_at)}`)
    console.log(`    last login:   ${fmt(w.owner.last_login_at)}`)
    console.log(``)
    console.log(`  Company:`)
    console.log(`    legal name: ${w.company_legal_name ?? '—'}`)
    console.log(`    org#:       ${w.org_number ?? '—'}`)
    console.log(`    SNI:        ${w.sni_code ?? '—'}`)
    console.log(``)
    console.log(`  Billing/tier:`)
    console.log(`    tier:                ${w.subscription_tier}`)
    console.log(`    trial_picked_tier:   ${w.trial_picked_tier ?? '—'}`)
    console.log(`    enterprise_inquiry:  ${fmt(w.enterprise_inquiry_at)}`)
    console.log(`    trial_ends_at:       ${fmt(w.trial_ends_at)}`)
    console.log(`    status:              ${w.status}`)
    console.log(`    stripe_customer:     ${w.stripe_customer_id ?? '—'}`)
    console.log(`    subscription_status: ${w.subscription_status ?? '—'}`)
    console.log(``)
    console.log(`  Onboarding:`)
    console.log(
      `    law_list_generation_status:     ${w.law_list_generation_status ?? 'null'}`
    )
    console.log(
      `    law_list_generation_started_at: ${fmt(w.law_list_generation_started_at)}`
    )
    console.log(
      `    law_list_generation_error:      ${w.law_list_generation_error ?? '—'}`
    )
    console.log(
      `    first_run_dismissed_at:    ${fmt(w.first_run_dismissed_at)}`
    )
    console.log(
      `    tutorial_fab_dismissed_at: ${fmt(w.tutorial_fab_dismissed_at)}`
    )
    console.log(
      `    first_run_tabs_viewed:     ${JSON.stringify(w.first_run_tabs_viewed)}`
    )
    console.log(``)
    console.log(`  Counts:`)
    console.log(`    members:           ${w._count.members}`)
    console.log(`    pending invites:   ${w._count.invitations}`)
    console.log(`    law_lists:         ${w._count.law_lists}`)
    console.log(`    onboarding_events: ${w._count.onboarding_events}`)
  }

  if (yesterdays.length === 0) {
    console.log('No workspaces created yesterday.')
  }

  // Surface last 5 onboarding events for the most recent workspace
  if (yesterdays.length > 0) {
    const wsId = yesterdays[0].id
    const events = await prisma.onboardingEvent.findMany({
      where: { workspace_id: wsId },
      orderBy: { created_at: 'desc' },
      take: 20,
    })
    console.log(`\nRecent onboarding events for ${yesterdays[0].slug}:`)
    for (const e of events) {
      console.log(
        `  ${fmt(e.created_at)}  ${e.event_type}  ${JSON.stringify(e.payload ?? {})}`
      )
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
