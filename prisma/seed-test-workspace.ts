/**
 * Seed script to create test workspaces for development
 * Run with: pnpm tsx prisma/seed-test-workspace.ts
 */

import { PrismaClient, WorkspaceRole, SubscriptionTier } from '@prisma/client'

const prisma = new PrismaClient()

// Test workspaces to create
const TEST_WORKSPACES = [
  {
    name: 'Acme AB',
    slug: 'acme-ab',
    tier: 'TEAM' as SubscriptionTier,
    sni_code: '62.010',
  },
  {
    name: 'Bygg & Fastighet AB',
    slug: 'bygg-fastighet',
    tier: 'SOLO' as SubscriptionTier,
    sni_code: '41.200',
  },
  {
    name: 'Konsult Gruppen',
    slug: 'konsult-gruppen',
    tier: 'TRIAL' as SubscriptionTier,
    sni_code: '70.220',
  },
]

async function main() {
  const testEmail = 'alexander.adstedt+10@kontorab.se'

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: testEmail },
    include: { workspace_members: { include: { workspace: true } } },
  })

  if (!user) {
    console.log(`User ${testEmail} not found in database`)
    return
  }

  console.log(`Found user: ${user.id} (${user.email})`)
  console.log(`Current workspaces: ${user.workspace_members.length}`)

  // Get existing workspace slugs
  const existingSlugs = user.workspace_members.map((m) => m.workspace.slug)

  // Create workspaces that don't exist yet
  for (const ws of TEST_WORKSPACES) {
    if (existingSlugs.includes(ws.slug)) {
      console.log(`  - "${ws.name}" already exists, skipping`)
      continue
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: ws.name,
        slug: ws.slug,
        owner_id: user.id,
        subscription_tier: ws.tier,
        sni_code: ws.sni_code,
        status: 'ACTIVE',
        trial_ends_at:
          ws.tier === 'TRIAL'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : null,
        members: {
          create: {
            user_id: user.id,
            role: 'OWNER' as WorkspaceRole,
          },
        },
      },
    })

    console.log(`  + Created "${workspace.name}" (${workspace.slug})`)
  }

  // Show final count
  const finalCount = await prisma.workspaceMember.count({
    where: { user_id: user.id },
  })
  console.log(`\nUser now has ${finalCount} workspace(s)`)
  console.log('Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
