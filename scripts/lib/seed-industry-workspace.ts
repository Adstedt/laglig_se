/* eslint-disable no-console */
/**
 * Shared engine for industry demo workspaces (Story 26.4, Input I-1).
 *
 * Unlike scripts/seed-demo-workspace.ts (which DRESSES the existing Nordviken
 * workspace created via onboarding), this CREATES a workspace + laglista from
 * scratch: fictitious company (allabolag-collision-checked, NO org number),
 * fictitious personas (.example emails), real laws from the catalog grouped
 * per industry, mixed compliance statuses (never all green), kravpunkter on
 * the expand-target group.
 *
 * The shared screenshot login anna.lindqvist@nordviken.example is granted
 * ADMIN membership so one login covers every capture session.
 *
 * Idempotent: workspace upserted by slug; groups/items wiped and re-created
 * per run (cheap, and keeps the staging deterministic).
 */
import {
  ComplianceStatus,
  LawListItemPriority,
  WorkspaceRole,
  PrismaClient,
} from '@prisma/client'

const U = ComplianceStatus.UPPFYLLD
const P = ComplianceStatus.PAGAENDE
const X = ComplianceStatus.EJ_UPPFYLLD
const N = ComplianceStatus.EJ_PABORJAD

export const STATUS = { U, P, X, N }

export interface SeedPersona {
  email: string
  name: string
  role: WorkspaceRole
  avatar: string
}

export interface SeedGroupItem {
  documentNumber: string
  status: ComplianceStatus
  /** "Hur påverkar detta oss?" column text (optional) */
  commentary?: string
}

export interface SeedGroup {
  name: string
  items: SeedGroupItem[]
}

export interface IndustrySeedSpec {
  ownerEmail: string
  workspaceName: string
  workspaceSlug: string
  personas: SeedPersona[]
  groups: SeedGroup[]
  /** group that gets kravpunkter (the screenshot expand target) */
  expandGroup: string
  kravTexts: string[]
}

const SCREENSHOT_LOGIN = 'anna.lindqvist@nordviken.example'

function fulfilledCountFor(status: ComplianceStatus, total: number): number {
  switch (status) {
    case U:
      return total
    case P:
      return Math.max(1, total - 1)
    case X:
      return 1
    default:
      return 0
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

export async function seedIndustryWorkspace(
  prisma: PrismaClient,
  spec: IndustrySeedSpec
): Promise<void> {
  const owner = await prisma.user.findUnique({
    where: { email: spec.ownerEmail },
    select: { id: true },
  })
  if (!owner) {
    // throw (not process.exit) so the caller's .finally($disconnect) runs
    // and owns the exit code (QA-26.4-G)
    throw new Error(`Owner ${spec.ownerEmail} not found`)
  }

  // 1) Workspace (upsert by slug; clearly fictitious, NO org_number) --------
  const ws = await prisma.workspace.upsert({
    where: { slug: spec.workspaceSlug },
    update: { name: spec.workspaceName },
    create: {
      name: spec.workspaceName,
      slug: spec.workspaceSlug,
      owner_id: owner.id,
    },
    select: { id: true, name: true, slug: true },
  })
  console.log(`Workspace → "${ws.name}" (${ws.slug}) id=${ws.id}`)

  await prisma.workspaceMember.upsert({
    where: {
      user_id_workspace_id: { user_id: owner.id, workspace_id: ws.id },
    },
    update: { role: WorkspaceRole.OWNER },
    create: {
      user_id: owner.id,
      workspace_id: ws.id,
      role: WorkspaceRole.OWNER,
    },
  })

  // 2) Personas + the shared screenshot login -------------------------------
  const personaIds: string[] = []
  const allPersonas: SeedPersona[] = [
    ...spec.personas,
    {
      email: SCREENSHOT_LOGIN,
      name: 'Anna Lindqvist',
      role: WorkspaceRole.ADMIN,
      avatar: '/demo-team/anna.png',
    },
  ]
  for (const p of allPersonas) {
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
    if (p.email !== SCREENSHOT_LOGIN) personaIds.push(user.id)
    await prisma.workspaceMember.upsert({
      where: {
        user_id_workspace_id: { user_id: user.id, workspace_id: ws.id },
      },
      update: { role: p.role },
      create: {
        user_id: user.id,
        workspace_id: ws.id,
        role: p.role,
        invited_by: owner.id,
      },
    })
    console.log(`  member: ${p.name} (${p.role})`)
  }

  // 3) Resolve laws ----------------------------------------------------------
  const wanted = spec.groups.flatMap((g) =>
    g.items.map((i) => i.documentNumber)
  )
  const docs = await prisma.legalDocument.findMany({
    where: { document_number: { in: wanted }, status: 'ACTIVE' },
    select: { id: true, document_number: true, title: true },
  })
  const byNumber = new Map(docs.map((d) => [d.document_number, d]))
  const missing = wanted.filter((w) => !byNumber.has(w))
  if (missing.length) {
    // throw, not process.exit — see owner check above (QA-26.4-G)
    throw new Error(`MISSING laws (fix the spec): ${missing.join(', ')}`)
  }

  // 4) Default list + groups + items (wipe & recreate for determinism) ------
  let list = await prisma.lawList.findFirst({
    where: { workspace_id: ws.id, is_default: true },
    select: { id: true },
  })
  if (!list) {
    list = await prisma.lawList.create({
      data: {
        workspace_id: ws.id,
        name: 'Huvudlista',
        is_default: true,
        created_by: owner.id,
      },
      select: { id: true },
    })
  }
  await prisma.lawListItem.deleteMany({ where: { law_list_id: list.id } })
  await prisma.lawListGroup.deleteMany({ where: { law_list_id: list.id } })

  let respCounter = 0
  for (let gi = 0; gi < spec.groups.length; gi++) {
    const g = spec.groups[gi]!
    const group = await prisma.lawListGroup.create({
      data: { law_list_id: list.id, name: g.name, position: gi },
      select: { id: true },
    })
    let uppfyllda = 0
    for (let i = 0; i < g.items.length; i++) {
      const item = g.items[i]!
      const doc = byNumber.get(item.documentNumber)!
      if (item.status === U) uppfyllda++
      const created = await prisma.lawListItem.create({
        data: {
          law_list_id: list.id,
          document_id: doc.id,
          group_id: group.id,
          position: i,
          compliance_status: item.status,
          responsible_user_id: personaIds[respCounter % personaIds.length]!,
          priority: priorityFor(item.status, i),
          // "Hur påverkar detta oss?" column reads business_context (the
          // spec key stays `commentary` for brevity; mapping fixed 2026-06-11
          // — the column showed "+ Lägg till" placeholders before)
          ...(item.commentary ? { business_context: item.commentary } : {}),
        },
        select: { id: true },
      })
      respCounter++

      if (g.name === spec.expandGroup) {
        const total = 3
        const fulfilled = fulfilledCountFor(item.status, total)
        await prisma.lawListItemRequirement.createMany({
          data: Array.from({ length: total }, (_, k) => ({
            list_item_id: created.id,
            text: spec.kravTexts[(i + k) % spec.kravTexts.length]!,
            is_fulfilled: k < fulfilled,
            position: k,
            created_by: owner.id,
          })),
        })
        // Print modal deep-link IDs for the screenshot session (brief Q3)
        console.log(
          `    item ${item.documentNumber} (${doc.title.slice(0, 40)}…) lawListItemId=${created.id}`
        )
      }
    }
    console.log(`  group ${g.name}: ${uppfyllda}/${g.items.length} uppfyllda`)
  }

  console.log(`\nDone. Workspace "${ws.name}" staged for screenshots.`)
}
