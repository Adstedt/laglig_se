/**
 * Seed script to create test notifications for development
 * Run with: pnpm tsx prisma/seed-notifications.ts
 *
 * Creates a mix of notification types (read + unread) so you can test:
 * - Bell badge with unread count
 * - Notification dropdown list
 * - Mark as read / mark all as read
 * - Different notification type icons
 * - Relative timestamps
 */

import { PrismaClient, NotificationType } from '@prisma/client'

const prisma = new PrismaClient()

const FAKE_ACTORS = [
  'Anna Svensson',
  'Erik Lindberg',
  'Maria Johansson',
  'Lars Nilsson',
  'Sofia Andersson',
]

const FAKE_TASK_TITLES = [
  'Uppdatera brandskyddspolicy',
  'Granska kemikalieförteckning',
  'Genomföra skyddsrond kontor',
  'Dokumentera riskbedömning lager',
  'Uppdatera delegationsordning',
  'Kontrollera ventilationssystem',
  'Boka företagshälsovård',
  'Revidera arbetsmiljöpolicy',
  'Åtgärda avvikelserapport #42',
  'Planera säkerhetsutbildning Q2',
]

interface SeedNotification {
  type: NotificationType
  title: string
  body: string
  entity_type: string
  entity_id: string | null
  read: boolean
  minutesAgo: number
}

function buildSeedNotifications(): SeedNotification[] {
  const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

  return [
    // --- UNREAD notifications (will show in bell) ---
    {
      type: 'TASK_ASSIGNED',
      title: 'Ny tilldelning',
      body: `${pick(FAKE_ACTORS)} tilldelade dig uppgiften "${pick(FAKE_TASK_TITLES)}"`,
      entity_type: 'task',
      entity_id: null, // will try to use a real task
      read: false,
      minutesAgo: 3,
    },
    {
      type: 'TASK_DUE_SOON',
      title: 'Uppgift förfaller snart',
      body: `Uppgiften "${pick(FAKE_TASK_TITLES)}" förfaller om 2 dagar`,
      entity_type: 'task',
      entity_id: null,
      read: false,
      minutesAgo: 15,
    },
    {
      type: 'TASK_OVERDUE',
      title: 'Förfallen uppgift',
      body: `Uppgiften "${pick(FAKE_TASK_TITLES)}" är förfallen sedan 3 dagar`,
      entity_type: 'task',
      entity_id: null,
      read: false,
      minutesAgo: 45,
    },
    {
      type: 'COMMENT_ADDED',
      title: 'Ny kommentar',
      body: `${pick(FAKE_ACTORS)} kommenterade på uppgiften "${pick(FAKE_TASK_TITLES)}"`,
      entity_type: 'task',
      entity_id: null,
      read: false,
      minutesAgo: 120,
    },
    {
      type: 'MENTION',
      title: 'Omnämnande',
      body: `${pick(FAKE_ACTORS)} nämnde dig i en kommentar på "${pick(FAKE_TASK_TITLES)}"`,
      entity_type: 'task',
      entity_id: null,
      read: false,
      minutesAgo: 200,
    },
    {
      type: 'STATUS_CHANGED',
      title: 'Statusändring',
      body: `${pick(FAKE_ACTORS)} ändrade status på "${pick(FAKE_TASK_TITLES)}" till Pågående`,
      entity_type: 'task',
      entity_id: null,
      read: false,
      minutesAgo: 360,
    },
    {
      type: 'AMENDMENT_DETECTED',
      title: 'Lagändring upptäckt',
      body: 'Arbetsmiljölagen (1977:1160) har ändrats genom SFS 2026:123',
      entity_type: 'change_event',
      entity_id: null,
      read: false,
      minutesAgo: 500,
    },

    // --- READ notifications (older, already seen) ---
    {
      type: 'TASK_ASSIGNED',
      title: 'Ny tilldelning',
      body: `${pick(FAKE_ACTORS)} tilldelade dig uppgiften "${pick(FAKE_TASK_TITLES)}"`,
      entity_type: 'task',
      entity_id: null,
      read: true,
      minutesAgo: 1440, // 1 day ago
    },
    {
      type: 'WEEKLY_DIGEST',
      title: 'Veckans uppgifter',
      body: 'Du har 5 uppgifter att slutföra denna vecka',
      entity_type: 'task',
      entity_id: null,
      read: true,
      minutesAgo: 2880, // 2 days ago
    },
    {
      type: 'STATUS_CHANGED',
      title: 'Statusändring',
      body: `${pick(FAKE_ACTORS)} ändrade status på "${pick(FAKE_TASK_TITLES)}" till Klar`,
      entity_type: 'task',
      entity_id: null,
      read: true,
      minutesAgo: 4320, // 3 days ago
    },
    {
      type: 'AMENDMENT_REMINDER',
      title: 'Ändringspåminnelse',
      body: 'Påminnelse: Diskrimineringslagen har uppdaterats — granska ändringarna',
      entity_type: 'change_event',
      entity_id: null,
      read: true,
      minutesAgo: 10080, // 7 days ago
    },
  ]
}

async function main() {
  // 1. Find the first user with a workspace
  const member = await prisma.workspaceMember.findFirst({
    include: {
      user: true,
      workspace: true,
    },
    orderBy: { joined_at: 'asc' },
  })

  if (!member) {
    console.log('No workspace members found. Create a workspace first.')
    return
  }

  const userId = member.user_id
  const workspaceId = member.workspace_id
  console.log(`User:      ${member.user.email} (${userId})`)
  console.log(`Workspace: ${member.workspace.name} (${workspaceId})`)

  // 2. Try to find some real task IDs to link notifications to
  const tasks = await prisma.task.findMany({
    where: { workspace_id: workspaceId },
    select: { id: true },
    take: 10,
    orderBy: { created_at: 'desc' },
  })
  const taskIds = tasks.map((t) => t.id)
  console.log(`Found ${taskIds.length} existing tasks to link to`)

  // 3. Clean up any previous seeded notifications (optional — remove this if you want to accumulate)
  const deleted = await prisma.notification.deleteMany({
    where: {
      user_id: userId,
      workspace_id: workspaceId,
      // Only delete those with our known seed titles to avoid removing real ones
      title: {
        in: [
          'Ny tilldelning',
          'Uppgift förfaller snart',
          'Förfallen uppgift',
          'Ny kommentar',
          'Omnämnande',
          'Statusändring',
          'Veckans uppgifter',
          'Lagändring upptäckt',
          'Ändringspåminnelse',
        ],
      },
    },
  })
  if (deleted.count > 0) {
    console.log(`Cleaned up ${deleted.count} previous seed notifications`)
  }

  // 4. Create notifications
  const notifications = buildSeedNotifications()
  let created = 0

  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i]!
    const now = Date.now()
    const createdAt = new Date(now - n.minutesAgo * 60 * 1000)

    // Use a real task ID if available, otherwise use a fake UUID
    const entityId =
      n.entity_type === 'task' && taskIds.length > 0
        ? (taskIds[i % taskIds.length] ?? null)
        : (n.entity_id ?? null)

    await prisma.notification.create({
      data: {
        user_id: userId,
        workspace_id: workspaceId,
        type: n.type,
        title: n.title,
        body: n.body,
        entity_type: n.entity_type,
        entity_id: entityId,
        read_at: n.read ? new Date(createdAt.getTime() + 30 * 60 * 1000) : null,
        created_at: createdAt,
      },
    })
    created++

    const readLabel = n.read ? '(read)' : '(UNREAD)'
    const timeLabel =
      n.minutesAgo < 60
        ? `${n.minutesAgo}m ago`
        : `${Math.round(n.minutesAgo / 60)}h ago`
    console.log(
      `  + ${n.type.padEnd(20)} ${readLabel.padEnd(10)} ${timeLabel.padStart(8)} — ${n.title}`
    )
  }

  // 5. Summary
  const unreadCount = notifications.filter((n) => !n.read).length
  console.log(
    `\nDone! Created ${created} notifications (${unreadCount} unread)`
  )
  console.log('Refresh your browser to see them in the notification bell.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
