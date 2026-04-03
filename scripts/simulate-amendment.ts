/**
 * Simulate an amendment to a law tracked by a workspace.
 *
 * Creates a fake ChangeEvent (with ai_summary) so the notification cron
 * picks it up and sends the full email + in-app notification flow.
 *
 * Usage:
 *   npx tsx scripts/simulate-amendment.ts
 *   npx tsx scripts/simulate-amendment.ts --dry-run
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

// --- Configuration ---
const TARGET_WORKSPACE_SLUG = 'golv-2000-aktiebolag-jgms8d'
const TARGET_USER_EMAIL = 'alexander.adstedt+75@kontorab.se'
const FAKE_AMENDMENT_SFS = 'SFS 2099:999' // Obviously fake, won't collide
const FAKE_SUMMARY =
  'Teständring: Två paragrafer ändras för att förtydliga arbetsgivarens ansvar vid hantering av kemiska risker på arbetsplatsen. Ändringarna träder i kraft den 1 juli 2026.'

async function main() {
  console.log('=== Simulate Amendment Notification ===')
  if (DRY_RUN) console.log('(DRY RUN)\n')

  // 1. Find workspace
  const workspace = await prisma.workspace.findFirst({
    where: { slug: TARGET_WORKSPACE_SLUG },
    include: {
      members: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  })

  if (!workspace) {
    console.error(`Workspace "${TARGET_WORKSPACE_SLUG}" not found`)
    process.exit(1)
  }

  console.log(`Workspace: ${workspace.name} (${workspace.id})`)
  console.log(
    `Members: ${workspace.members.map((m) => `${m.user.email} (${m.role})`).join(', ')}`
  )

  // Verify target user is a member
  const targetMember = workspace.members.find(
    (m) => m.user.email === TARGET_USER_EMAIL
  )
  if (!targetMember) {
    console.error(
      `User ${TARGET_USER_EMAIL} is not a member of ${workspace.name}`
    )
    process.exit(1)
  }
  console.log(
    `Target user: ${targetMember.user.name} (${targetMember.user.email})\n`
  )

  // 2. Find a law from their law list
  const lawListItem = await prisma.lawListItem.findFirst({
    where: {
      law_list: { workspace_id: workspace.id },
    },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          document_number: true,
          slug: true,
          content_type: true,
        },
      },
      law_list: { select: { name: true } },
    },
    orderBy: { added_at: 'asc' },
  })

  if (!lawListItem) {
    console.error(`No laws found in law lists for workspace ${workspace.name}`)
    process.exit(1)
  }

  const doc = lawListItem.document
  console.log(`Law list: ${lawListItem.law_list.name}`)
  console.log(`Target law: ${doc.title}`)
  console.log(`Document: ${doc.document_number} (${doc.content_type})`)
  console.log(`Slug: ${doc.slug}\n`)

  // 3. Check notification preferences
  const prefs = await prisma.notificationPreference.findFirst({
    where: {
      user_id: targetMember.user.id,
      workspace_id: workspace.id,
    },
  })
  console.log(
    `Notification prefs: ${prefs ? `email=${prefs.email_enabled}, amendment=${prefs.amendment_detected_enabled}` : 'none (defaults apply — all enabled)'}`
  )

  if (DRY_RUN) {
    console.log('\n--- Would create: ---')
    console.log(`ChangeEvent:`)
    console.log(`  document_id: ${doc.id}`)
    console.log(`  content_type: ${doc.content_type}`)
    console.log(`  change_type: AMENDMENT`)
    console.log(`  amendment_sfs: ${FAKE_AMENDMENT_SFS}`)
    console.log(`  ai_summary: "${FAKE_SUMMARY}"`)
    console.log(`  notification_sent: false`)
    console.log(`\nThen trigger: GET /api/cron/notify-amendment-changes`)
    return
  }

  // 4. Create the fake ChangeEvent
  const changeEvent = await prisma.changeEvent.create({
    data: {
      document_id: doc.id,
      content_type: doc.content_type,
      change_type: 'AMENDMENT',
      amendment_sfs: FAKE_AMENDMENT_SFS,
      ai_summary: FAKE_SUMMARY,
      ai_summary_generated_at: new Date(),
      detected_at: new Date(),
      notification_sent: false,
    },
  })

  console.log(`Created ChangeEvent: ${changeEvent.id}`)
  console.log(`  document: ${doc.title}`)
  console.log(`  amendment_sfs: ${FAKE_AMENDMENT_SFS}`)
  console.log(`  notification_sent: false`)
  console.log(`\nNow trigger the notification cron to send the email:`)
  console.log(`  curl http://localhost:3000/api/cron/notify-amendment-changes`)
  console.log(`  (or wait for 07:00 UTC on production)\n`)
  console.log(`To clean up afterwards:`)
  console.log(`  DELETE FROM change_events WHERE id = '${changeEvent.id}';`)
}

main()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
