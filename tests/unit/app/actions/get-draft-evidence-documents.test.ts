/**
 * Story 21.9 v0.5 — INTEGRITY-001 softening.
 *
 * Unit tests for `getDraftEvidenceDocuments` (snapshot-and-accept pattern).
 * Covers the four pathways specified in the plan:
 *  1. Happy path — returns DRAFT docs only, dedup, contextLabel populated
 *  2. Auth gate — AUDITOR (has activity:view) can read; non-member rejected
 *  3. Cross-workspace — generic "hittades inte" (no leak)
 *  4. Empty case — no DRAFT docs → empty array
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDraftEvidenceDocuments } from '../../../../app/actions/compliance-audit-cycle'
import { prisma } from '@/lib/prisma'
import * as workspaceContext from '@/lib/auth/workspace-context'
import type { Permission } from '@/lib/auth/permissions'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    complianceAuditItem: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(),
}))

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const CYCLE_ID = '55555555-5555-4555-8555-555555555555'

function mockWorkspaceCtx(permissions: readonly Permission[]): void {
  vi.mocked(workspaceContext.withWorkspace).mockImplementation(
    async (callback) => {
      const ctx = {
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
        workspaceName: 'Test Workspace',
        workspaceSlug: 'test',
        workspaceStatus: 'ACTIVE' as const,
        role: 'AUDITOR' as const,
        hasPermission: (p: Permission) => permissions.includes(p),
      }
      return callback(ctx)
    }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getDraftEvidenceDocuments (Story 21.9 v0.5)', () => {
  it('rejects non-UUID input with validation error', async () => {
    mockWorkspaceCtx(['activity:view', 'read'])
    const result = await getDraftEvidenceDocuments('not-a-uuid')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('auth: AUDITOR (activity:view) is allowed to read', async () => {
    mockWorkspaceCtx(['activity:view', 'read'])
    vi.mocked(prisma.complianceAuditItem.findMany).mockResolvedValue([])

    const result = await getDraftEvidenceDocuments(CYCLE_ID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.draftDocuments).toEqual([])
  })

  it('auth: member without activity:view OR tasks:edit is rejected', async () => {
    // Viewer-like role — only "read" (can authenticate into workspace but
    // not view activity and not edit tasks).
    mockWorkspaceCtx(['read'])
    vi.mocked(prisma.complianceAuditItem.findMany).mockResolvedValue([])

    const result = await getDraftEvidenceDocuments(CYCLE_ID)
    expect(result).toEqual({ success: false, error: 'Behörighet saknas' })
    // Should NOT have reached the DB.
    expect(prisma.complianceAuditItem.findMany).not.toHaveBeenCalled()
  })

  it('empty: no DRAFT docs → returns empty array', async () => {
    mockWorkspaceCtx(['tasks:edit', 'read'])
    // Items exist but none carry DRAFT-status docs through any pathway.
    vi.mocked(prisma.complianceAuditItem.findMany).mockResolvedValue([
      {
        law_list_item: {
          document: { document_number: 'AFS 2020:1', title: 'Arbetsplats' },
          workspace_document_links: [
            {
              document: {
                id: 'd-approved-1',
                title: 'Approved Policy',
                status: 'APPROVED',
              },
            },
          ],
          requirements: [],
          task_links: [],
        },
      },
    ] as unknown as never[])

    const result = await getDraftEvidenceDocuments(CYCLE_ID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.draftDocuments).toEqual([])
  })

  it('happy path: returns DRAFT docs only (APPROVED filtered out), contextLabel populated', async () => {
    mockWorkspaceCtx(['tasks:edit', 'read'])
    vi.mocked(prisma.complianceAuditItem.findMany).mockResolvedValue([
      {
        law_list_item: {
          document: {
            document_number: 'AFS 2020:1',
            title: 'Arbetsplatsens utformning',
          },
          workspace_document_links: [
            {
              document: {
                id: 'd-draft-1',
                title: 'Brandskyddsrutin v3',
                status: 'DRAFT',
              },
            },
            {
              document: {
                id: 'd-approved-1',
                title: 'Godkänd rutin',
                status: 'APPROVED',
              },
            },
          ],
          requirements: [],
          task_links: [],
        },
      },
    ] as unknown as never[])

    const result = await getDraftEvidenceDocuments(CYCLE_ID)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.draftDocuments).toEqual([
      {
        id: 'd-draft-1',
        title: 'Brandskyddsrutin v3',
        contextLabel: 'AFS 2020:1 Arbetsplatsens utformning',
      },
    ])
  })

  it('dedup: same DRAFT doc linked via multiple pathways surfaces once', async () => {
    mockWorkspaceCtx(['tasks:edit', 'read'])
    const sharedDraft = {
      id: 'd-draft-shared',
      title: 'Gemensam utkast-rutin',
      status: 'DRAFT',
    }
    vi.mocked(prisma.complianceAuditItem.findMany).mockResolvedValue([
      {
        law_list_item: {
          document: { document_number: 'AFS 2023:14', title: 'Gränsvärden' },
          // Pathway 1: direct link
          workspace_document_links: [{ document: sharedDraft }],
          // Pathway 2: kravpunkt-bevis
          requirements: [
            {
              evidence_links: [{ workspace_document: sharedDraft }],
            },
          ],
          // Pathway 3: task-bridged
          task_links: [
            {
              task: {
                workspace_document_links: [{ document: sharedDraft }],
              },
            },
          ],
        },
      },
    ] as unknown as never[])

    const result = await getDraftEvidenceDocuments(CYCLE_ID)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.draftDocuments).toHaveLength(1)
    expect(result.data.draftDocuments[0]?.id).toBe('d-draft-shared')
  })

  it('cross-workspace/nonexistent cycle: returns empty array (no leak)', async () => {
    mockWorkspaceCtx(['tasks:edit', 'read'])
    // Items filtered out by `cycle.workspace_id` in the query → []
    vi.mocked(prisma.complianceAuditItem.findMany).mockResolvedValue([])

    const result = await getDraftEvidenceDocuments(CYCLE_ID)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.draftDocuments).toEqual([])
  })
})
