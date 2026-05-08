/**
 * Story 24.4 QA gate TEST-001: E2E happy-path for the Epic 24 import flow.
 *
 * Pre-seeds a LawListImport in AWAITING_REVIEW status with three MATCHED_HIGH
 * rows (real LegalDocument FKs), then drives the user surface:
 *
 *   /laglistor/skapa/[importId]/granska
 *     → click "Acceptera alla höga"
 *     → confirm
 *     → click "Bekräfta och skapa lista"
 *     → fill list name + click "Bekräfta"
 *     → assert redirect to /laglistor?list={lawListId}
 *     → assert items present in the new list
 *
 * Pre-seeding bypasses the Anthropic matching call (~$0.20/run) per the gate
 * recommendation. Cleanup deletes the import + spawned LawList in afterAll.
 */

import { test, expect } from '@playwright/test'
import { PrismaClient, type Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const TEST_EMAIL = process.env.TEST_USER_EMAIL
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD

test.skip(
  !TEST_EMAIL || !TEST_PASSWORD,
  'TEST_USER_EMAIL + TEST_USER_PASSWORD must be set in .env.local'
)

interface SeededImport {
  importId: string
  workspaceId: string
  rowIds: string[]
  docIds: string[]
}

let seeded: SeededImport | null = null
let createdLawListId: string | null = null

async function seedImport(): Promise<SeededImport> {
  // Resolve workspace via the test user's email (supports + alias for the
  // dev browser session — auto-memory note: dev session uses +111 alias).
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: TEST_EMAIL! },
        { email: { contains: TEST_EMAIL!.split('@')[0]! } },
      ],
    },
    include: { workspace_members: { take: 1 } },
  })
  if (!user || user.workspace_members.length === 0) {
    throw new Error(
      `E2E import-flow: no workspace found for ${TEST_EMAIL}. ` +
        `Verify the test user exists and is a workspace member.`
    )
  }
  const workspaceId = user.workspace_members[0]!.workspace_id

  // Pull three real LegalDocument IDs — the schema's FK on
  // matched_document_id rejects synthetic IDs with P2003.
  const docs = await prisma.legalDocument.findMany({
    select: { id: true, title: true, document_number: true },
    take: 3,
    orderBy: { created_at: 'desc' },
  })
  if (docs.length < 3) {
    throw new Error(
      `E2E import-flow: need ≥3 LegalDocument rows for FK seeding; found ${docs.length}.`
    )
  }
  const docIds = docs.map((d) => d.id)

  const importRow = await prisma.lawListImport.create({
    data: {
      workspace_id: workspaceId,
      created_by_user_id: user.id,
      filename: `e2e-import-flow-${Date.now()}.xlsx`,
      source_type: 'xlsx',
      status: 'AWAITING_REVIEW',
      row_count: 3,
      column_mapping: {
        titel: 'col_0',
        sfs_nummer: 'col_1',
      } as Prisma.InputJsonValue,
      rows: {
        create: docs.map((doc, idx) => ({
          row_index: idx,
          source_titel: doc.title,
          source_sfs_nummer: doc.document_number,
          source_raw: {
            col_0: doc.title,
            col_1: doc.document_number,
          } as Prisma.InputJsonValue,
          match_status: 'MATCHED_HIGH',
          match_confidence_score: 0.95,
          matched_document_id: doc.id,
          match_reasoning: 'Pre-seeded for E2E test (24.4 TEST-001).',
        })),
      },
    },
    include: { rows: true },
  })

  return {
    importId: importRow.id,
    workspaceId,
    rowIds: importRow.rows.map((r) => r.id),
    docIds,
  }
}

test.beforeAll(async () => {
  seeded = await seedImport()
})

test.afterAll(async () => {
  if (createdLawListId) {
    // Spawned by commitImport — deletes cascade items.
    await prisma.lawList
      .delete({ where: { id: createdLawListId } })
      .catch(() => undefined)
  }
  if (seeded) {
    await prisma.lawListImport
      .delete({ where: { id: seeded.importId } })
      .catch(() => undefined)
  }
  await prisma.$disconnect()
})

test.describe('Epic 24 import-flow happy-path', () => {
  test('accept-all-high → commit → redirect → items present', async ({
    page,
  }) => {
    if (!seeded) throw new Error('seed missing')

    // Login.
    await page.goto('/login')
    await page.fill('input[type="email"]', TEST_EMAIL!)
    await page.fill('input[type="password"]', TEST_PASSWORD!)
    await page.click('button[type="submit"]')
    await page.waitForURL(
      (url) =>
        !url.pathname.startsWith('/login') &&
        !url.pathname.startsWith('/signup'),
      { timeout: 15_000 }
    )

    // Navigate to the granska review surface for the seeded import.
    await page.goto(`/laglistor/skapa/${seeded.importId}/granska`)
    await expect(page.getByText('Granska import')).toBeVisible({
      timeout: 15_000,
    })

    // Acceptera alla höga (3 rows pre-seeded as MATCHED_HIGH).
    const acceptAllButton = page.getByRole('button', {
      name: /Acceptera alla höga/,
    })
    await expect(acceptAllButton).toBeVisible()
    await acceptAllButton.click()

    // Confirm dialog.
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Acceptera' })
      .click()

    // Wait for the toast / state update — the "Acceptera alla höga" button
    // disappears once pendingHighCount drops to zero.
    await expect(acceptAllButton).toBeHidden({ timeout: 10_000 })

    // Bekräfta och skapa lista — opens commit dialog.
    const commitOpen = page.getByRole('button', {
      name: 'Bekräfta och skapa lista',
    })
    await expect(commitOpen).toBeEnabled()
    await commitOpen.click()

    // Fill list name + commit. The pre-fill is the import filename; replace
    // with a uniquely-suffixed name so the cleanup query finds exactly the
    // row this run created.
    const listName = `E2E-import-${Date.now()}`
    const nameInput = page.locator('input#listName')
    await nameInput.fill(listName)
    await page.getByRole('button', { name: 'Bekräfta', exact: true }).click()

    // Assert redirect to /laglistor?list={id}.
    await page.waitForURL(/\/laglistor\?list=/, { timeout: 15_000 })
    const url = new URL(page.url())
    const lawListId = url.searchParams.get('list')
    expect(lawListId).toBeTruthy()
    createdLawListId = lawListId

    // Verify the list was actually written + has 3 items.
    const items = await prisma.lawListItem.findMany({
      where: { law_list_id: lawListId! },
      select: { document_id: true },
    })
    expect(items).toHaveLength(3)
    const seededDocIds = new Set(seeded.docIds)
    for (const item of items) {
      expect(seededDocIds.has(item.document_id)).toBe(true)
    }
  })
})
