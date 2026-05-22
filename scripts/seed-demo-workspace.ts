/* eslint-disable no-console */
/**
 * Seeds the demo workspace so it looks like a real, actively-used product for the
 * landing-page hero screenshot (Laglistor / Efterlevnad view).
 *
 * IDEMPOTENT & NON-DESTRUCTIVE to the workspace structure:
 *  - Renames the workspace to a clearly-fictitious hospitality company.
 *  - Upserts 5 fictitious teammates (by email) + workspace memberships (varied roles).
 *  - Sets a realistic per-group compliance_status mix on existing list items.
 *  - Round-robins responsible_user_id across the 5 teammates (varied avatars).
 *  - Seeds 3 kravpunkter per Arbetsrätt item (the expand target) with fulfilled
 *    counts that track each item's status; varies priority.
 *
 * Run: pnpm tsx scripts/seed-demo-workspace.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

// eslint-disable-next-line import/first
import { prisma } from '../lib/prisma'
// eslint-disable-next-line import/first
import {
  ComplianceStatus,
  LawListItemPriority,
  WorkspaceRole,
} from '@prisma/client'

const OWNER_EMAIL = 'alexander.adstedt+111@kontorab.se'
const NEW_WORKSPACE_NAME = 'Nordviken Hotell & Konferens AB'

type Persona = {
  email: string
  name: string
  role: WorkspaceRole
  avatar: string
}
const TEAM: Persona[] = [
  {
    email: 'anna.lindqvist@nordviken.example',
    name: 'Anna Lindqvist',
    role: WorkspaceRole.ADMIN,
    avatar: '/demo-team/anna.png',
  },
  {
    email: 'sofia.karlsson@nordviken.example',
    name: 'Sofia Karlsson',
    role: WorkspaceRole.HR_MANAGER,
    avatar: '/demo-team/sofia.png',
  },
  {
    email: 'erik.bergstrom@nordviken.example',
    name: 'Erik Bergström',
    role: WorkspaceRole.MEMBER,
    avatar: '/demo-team/erik.png',
  },
  {
    email: 'johan.nilsson@nordviken.example',
    name: 'Johan Nilsson',
    role: WorkspaceRole.MEMBER,
    avatar: '/demo-team/johan.png',
  },
  {
    email: 'maria.holm@nordviken.example',
    name: 'Maria Holm',
    role: WorkspaceRole.MEMBER,
    avatar: '/demo-team/maria.png',
  },
]

const U = ComplianceStatus.UPPFYLLD
const P = ComplianceStatus.PAGAENDE
const X = ComplianceStatus.EJ_UPPFYLLD
const N = ComplianceStatus.EJ_PABORJAD

// Per-group ordered status plan. Numerator (UPPFYLLD) shown / applicable denominator.
const GROUP_PLAN: Record<string, ComplianceStatus[]> = {
  Bolagsrätt: [U, U, U], // 3/3
  Arbetsrätt: [U, U, P, U, U, X, U, U, P, U, U, N, U, U, P, U, X, U, N], // 12/19 (expand target)
  'Skatt & Redovisning': [U, U, U, P], // 3/4
  'Restaurang & Alkohol': [U, U, X], // 2/3
  'Hotell & Logi': [U, U], // 2/2
  Konsumenträtt: [U, P], // 1/2
  Dataskydd: [U, X], // 1/2
  Arbetsmiljö: [U, P, U, U, P, X, U, P, U, U, P, N, U, P, U, X, U, N], // 9/18
  'Brand & Säkerhet': [U, U, U, U, P, P, N], // 4/7
  'Fastighet & Byggrätt': [U, P, N], // 1/3
  'Hälsa & Säkerhet': [U, P], // 1/2
  'Aktiviteter & Friluftsliv': [U, N], // 1/2
}

const EXPAND_GROUP = 'Arbetsrätt'

const KRAV_TEXTS = [
  'Rutin för efterlevnad är dokumenterad och tillgänglig för berörd personal.',
  'Ansvarig är utsedd och känner till sitt ansvarsområde.',
  'Återkommande kontroll genomförs och resultatet dokumenteras.',
  'Berörda medarbetare har fått relevant information och utbildning.',
  'Avvikelser hanteras och följs upp enligt fastställd rutin.',
]

function fulfilledCountFor(status: ComplianceStatus, total: number): number {
  switch (status) {
    case U:
      return total // all fulfilled
    case P:
      return Math.max(1, total - 1) // most fulfilled, in progress
    case X:
      return 1 // some work, not compliant
    default:
      return 0 // not started
  }
}

function priorityFor(
  status: ComplianceStatus,
  idx: number
): LawListItemPriority {
  if (status === X || status === N) return LawListItemPriority.HIGH
  if (status === P) return LawListItemPriority.MEDIUM
  return idx % 2 === 0 ? LawListItemPriority.LOW : LawListItemPriority.MEDIUM
}

async function main() {
  const owner = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    select: {
      id: true,
      workspace_members: { select: { workspace_id: true }, take: 1 },
    },
  })
  const ownerId = owner?.id
  const workspaceId = owner?.workspace_members[0]?.workspace_id
  if (!ownerId || !workspaceId) {
    console.error('Owner/workspace not found')
    process.exit(1)
  }

  // 1) Rename workspace ----------------------------------------------------
  const ws = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { name: NEW_WORKSPACE_NAME },
    select: { id: true, name: true, slug: true },
  })
  console.log(`Workspace → "${ws.name}" (${ws.slug})`)

  // 2) Upsert teammates + memberships -------------------------------------
  const personaIds: string[] = []
  for (const p of TEAM) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name, avatar_url: p.avatar },
      create: {
        email: p.email,
        name: p.name,
        avatar_url: p.avatar,
        email_verified: true,
      },
      select: { id: true },
    })
    personaIds.push(user.id)
    await prisma.workspaceMember.upsert({
      where: {
        user_id_workspace_id: { user_id: user.id, workspace_id: workspaceId },
      },
      update: { role: p.role },
      create: {
        user_id: user.id,
        workspace_id: workspaceId,
        role: p.role,
        invited_by: ownerId,
      },
    })
    console.log(`  member: ${p.name} (${p.role})`)
  }

  // 3) Default list + groups ----------------------------------------------
  const defaultList = await prisma.lawList.findFirst({
    where: { workspace_id: workspaceId, is_default: true },
    select: { id: true, name: true },
  })
  if (!defaultList) {
    console.error('No default list')
    process.exit(1)
  }

  const groups = await prisma.lawListGroup.findMany({
    where: { law_list_id: defaultList.id },
    select: { id: true, name: true },
  })

  let respCounter = 0
  let updatedItems = 0
  for (const g of groups) {
    const items = await prisma.lawListItem.findMany({
      where: { law_list_id: defaultList.id, group_id: g.id },
      orderBy: [{ position: 'asc' }, { added_at: 'asc' }],
      select: { id: true },
    })
    const plan = GROUP_PLAN[g.name]
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      const status = plan ? plan[i % plan.length]! : N
      const responsibleId = personaIds[respCounter % personaIds.length]!
      respCounter++
      await prisma.lawListItem.update({
        where: { id: item.id },
        data: {
          compliance_status: status,
          responsible_user_id: responsibleId,
          ...(g.name === EXPAND_GROUP
            ? { priority: priorityFor(status, i) }
            : {}),
        },
      })
      updatedItems++

      // 4) Kravpunkter for the expand target only --------------------------
      if (g.name === EXPAND_GROUP) {
        await prisma.lawListItemRequirement.deleteMany({
          where: { list_item_id: item.id },
        })
        const total = 3
        const fulfilled = fulfilledCountFor(status, total)
        await prisma.lawListItemRequirement.createMany({
          data: Array.from({ length: total }, (_, k) => ({
            list_item_id: item.id,
            text: KRAV_TEXTS[(i + k) % KRAV_TEXTS.length]!,
            is_fulfilled: k < fulfilled,
            position: k,
            created_by: ownerId,
          })),
        })
      }
    }
    if (plan) {
      const num = items.filter((_, i) => plan[i % plan.length] === U).length
      const den = items.length
      console.log(`  group ${g.name}: ${num}/${den} uppfyllda`)
    }
  }

  console.log(
    `\nUpdated ${updatedItems} items across ${groups.length} groups. Done.`
  )
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
