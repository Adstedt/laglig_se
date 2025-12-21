/**
 * Seed script to create a placeholder workspace for test users
 * Run with: pnpm tsx prisma/seed-test-workspace.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const testEmail = 'alexander.adstedt+10@kontorab.se'

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: testEmail },
    include: { workspace_members: true },
  })

  if (!user) {
    console.log(`User ${testEmail} not found in database`)
    return
  }

  console.log(`Found user: ${user.id} (${user.email})`)

  // Check if user already has a workspace
  if (user.workspace_members.length > 0) {
    console.log(
      `User already has ${user.workspace_members.length} workspace(s)`
    )
    return
  }

  // Create a placeholder workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Test Workspace',
      slug: `test-workspace-${Date.now()}`,
      owner_id: user.id,
      subscription_tier: 'TRIAL',
      status: 'ACTIVE',
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      members: {
        create: {
          user_id: user.id,
          role: 'OWNER',
        },
      },
    },
  })

  console.log(`Created workspace: ${workspace.id} (${workspace.name})`)
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
