import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: 'almasa-havshotell-ab-fvarlj' },
    select: { id: true, name: true, slug: true, status: true },
  })

  if (!workspace) {
    console.log('Workspace not found')
    process.exit(1)
  }

  console.log(
    `Workspace: ${workspace.name} (${workspace.slug}) — status ${workspace.status}\n`
  )

  const members = await prisma.workspaceMember.findMany({
    where: { workspace_id: workspace.id },
    select: {
      role: true,
      joined_at: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { joined_at: 'asc' },
  })

  console.table(
    members.map((m) => ({
      role: m.role,
      name: m.user.name ?? '—',
      email: m.user.email,
      joined: m.joined_at.toISOString().slice(0, 10),
    }))
  )

  console.log(`\nTotal: ${members.length} members`)

  const invites = await prisma.workspaceInvitation.findMany({
    where: { workspace_id: workspace.id },
    select: {
      role: true,
      email: true,
      status: true,
      expires_at: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  })

  if (invites.length > 0) {
    console.log('\nInvitations:')
    console.table(
      invites.map((i) => ({
        role: i.role,
        email: i.email,
        status: i.status,
        sent: i.created_at.toISOString().slice(0, 10),
        expires: i.expires_at.toISOString().slice(0, 10),
      }))
    )
  } else {
    console.log('\nNo invitations.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
