/**
 * One-shot UAT helper: demote alexander.adstedt+10@kontorab.se from MEMBER to
 * AUDITOR in the Almåsa Havshotell AB workspace so the Epic 21 permission-matrix
 * sweep (UAT plan §8) can be exercised without waiting for the +200 signup
 * email rate limit to clear.
 *
 * Reversible via Settings → Team or by running this script with --revert.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const TARGET_EMAIL = 'alexander.adstedt+10@kontorab.se'
const WORKSPACE_SLUG = 'almasa-havshotell-ab-fvarlj'

async function main() {
  const revert = process.argv.includes('--revert')
  const targetRole = revert ? 'MEMBER' : 'AUDITOR'

  const workspace = await prisma.workspace.findUnique({
    where: { slug: WORKSPACE_SLUG },
    select: { id: true, name: true },
  })
  if (!workspace) {
    console.error(`Workspace ${WORKSPACE_SLUG} not found`)
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: { id: true, name: true, email: true },
  })
  if (!user) {
    console.error(`User ${TARGET_EMAIL} not found`)
    process.exit(1)
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { workspace_id: workspace.id, user_id: user.id },
    select: { id: true, role: true },
  })
  if (!member) {
    console.error(`${TARGET_EMAIL} is not a member of ${workspace.name}`)
    process.exit(1)
  }

  if (member.role === targetRole) {
    console.log(`No change — ${TARGET_EMAIL} is already ${targetRole}.`)
    return
  }

  console.log(
    `Updating ${user.name ?? user.email} (${TARGET_EMAIL}) in ${workspace.name}: ${member.role} → ${targetRole}`
  )

  await prisma.workspaceMember.update({
    where: { id: member.id },
    data: { role: targetRole },
  })

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
