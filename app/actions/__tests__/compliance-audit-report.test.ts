/**
 * Story 21.11 — Unit tests for `app/actions/compliance-audit-report.ts`.
 *
 * Mock boilerplate mirrors `app/actions/__tests__/compliance-audit-cycle.test.ts`.
 * The renderer is NOT mocked — we exercise the full action → renderer path so
 * integration across the seam is covered. The three downstream actions
 * (getCycleById, getCycleItemsForCycle, listFindingsForCycle) ARE mocked so
 * the test matrix stays focused on compose-and-propagate behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getRevisionsrapportInput,
  generateCycleReport,
  shouldRegenerateReport,
} from '../compliance-audit-report'
import { reportNeedsRegeneration } from '@/lib/compliance-audit/report-staleness'
import { getCycleById } from '../compliance-audit-cycle'
import { getCycleItemsForCycle } from '../compliance-audit-item'
import { listFindingsForCycle } from '../compliance-finding'
import { prisma } from '@/lib/prisma'
import * as workspaceContext from '@/lib/auth/workspace-context'
import { getStorageClient } from '@/lib/supabase/storage'
import { logActivity } from '@/lib/services/activity-logger'
import { renderRevisionsrapportPdf } from '@/lib/compliance-audit/revisionsrapport-to-pdf'
import type { Permission } from '@/lib/auth/permissions'
import type { WorkspaceRole } from '@prisma/client'
import type { CycleDetail } from '../compliance-audit-cycle'
import type {
  CycleItemRow,
  CyclePartial,
  GetCycleItemsResult,
} from '../compliance-audit-item'
import type { FindingRow, ListFindingsResult } from '../compliance-finding'

// ============================================================================
// Module mocks
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    complianceEvidenceSnapshot: {
      findMany: vi.fn(),
    },
    complianceAuditCycle: {
      findFirst: vi.fn(),
    },
    complianceAuditItem: {
      findFirst: vi.fn(),
    },
    complianceFinding: {
      findFirst: vi.fn(),
    },
    complianceAuditReport: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(),
}))

vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: vi.fn(),
}))

vi.mock('@/lib/services/activity-logger', () => ({
  logActivity: vi.fn(),
}))

vi.mock('@/lib/compliance-audit/revisionsrapport-to-pdf', () => ({
  renderRevisionsrapportPdf: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('../compliance-audit-cycle', async () => {
  const actual = await vi.importActual<
    typeof import('../compliance-audit-cycle')
  >('../compliance-audit-cycle')
  return {
    ...actual,
    getCycleById: vi.fn(),
  }
})

vi.mock('../compliance-audit-item', async () => {
  const actual = await vi.importActual<
    typeof import('../compliance-audit-item')
  >('../compliance-audit-item')
  return {
    ...actual,
    getCycleItemsForCycle: vi.fn(),
  }
})

vi.mock('../compliance-finding', async () => {
  const actual = await vi.importActual<typeof import('../compliance-finding')>(
    '../compliance-finding'
  )
  return {
    ...actual,
    listFindingsForCycle: vi.fn(),
  }
})

// ============================================================================
// Fixtures
// ============================================================================

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const CYCLE_ID = '44444444-4444-4444-8444-444444444444'
const LAW_LIST_ID = '55555555-5555-4555-8555-555555555555'

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  OWNER: ['read', 'activity:view', 'tasks:edit'],
  ADMIN: ['read', 'activity:view', 'tasks:edit'],
  HR_MANAGER: ['read', 'tasks:edit'],
  MEMBER: ['read', 'tasks:edit'],
  AUDITOR: ['read', 'activity:view'],
}

function mockWorkspaceCtx(
  opts: { role?: WorkspaceRole; permissions?: readonly Permission[] } = {}
): void {
  const perms = opts.permissions ?? ROLE_PERMISSIONS[opts.role ?? 'OWNER']
  vi.mocked(workspaceContext.withWorkspace).mockImplementation(
    async (callback, requiredPermission) => {
      const ctx = {
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
        workspaceName: 'Test Workspace',
        workspaceSlug: 'test',
        workspaceStatus: 'ACTIVE' as const,
        role: opts.role ?? 'OWNER',
        hasPermission: (p: Permission) => perms.includes(p),
      }
      if (requiredPermission && !ctx.hasPermission(requiredPermission)) {
        throw new Error(`Permission denied: ${requiredPermission}`)
      }
      return callback(ctx)
    }
  )
}

function makeCycle(overrides: Partial<CycleDetail> = {}): CycleDetail {
  return {
    id: CYCLE_ID,
    name: 'Test cycle',
    status: 'AVSLUTAD',
    auditType: 'INTERN',
    scheduledStart: new Date('2026-01-01T00:00:00.000Z'),
    scheduledEnd: new Date('2026-03-31T00:00:00.000Z'),
    lawChangeCutoffDate: new Date('2026-01-01T00:00:00.000Z'),
    leadAuditor: { id: USER_ID, name: 'Lead' },
    lawList: { id: LAW_LIST_ID, name: 'Test laglista' },
    itemCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-31T00:00:00.000Z'),
    lawListId: LAW_LIST_ID,
    scopeDefinition: { kind: 'all' },
    sealHash: null,
    sealedAt: null,
    sealedBy: null,
    createdBy: { id: USER_ID, name: 'Creator' },
    deletedAt: null,
    ...overrides,
  }
}

function makeItemsResult(
  items: CycleItemRow[] = [],
  cycleStatus: CyclePartial['status'] = 'AVSLUTAD'
): { success: true; data: GetCycleItemsResult } {
  return {
    success: true,
    data: {
      items,
      cycle: {
        id: CYCLE_ID,
        status: cycleStatus,
        name: 'Test cycle',
        sealHash: null,
      },
    },
  }
}

function makeFindingsResult(findings: FindingRow[] = []): {
  success: true
  data: ListFindingsResult
} {
  return { success: true, data: { findings } }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWorkspaceCtx({ role: 'OWNER' })
  vi.mocked(prisma.complianceEvidenceSnapshot.findMany).mockResolvedValue([])
  vi.mocked(getCycleById).mockResolvedValue({
    success: true,
    data: { cycle: makeCycle() },
  })
  vi.mocked(getCycleItemsForCycle).mockResolvedValue(makeItemsResult())
  vi.mocked(listFindingsForCycle).mockResolvedValue(makeFindingsResult())
})

// ============================================================================
// Happy paths
// ============================================================================

describe('getRevisionsrapportInput — happy path', () => {
  it('AVSLUTAD cycle with zero snapshots returns rendered HTML + input', async () => {
    const result = await getRevisionsrapportInput({ cycleId: CYCLE_ID })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.input.snapshots).toEqual([])
    expect(result.data!.input.cycle.name).toBe('Test cycle')
    expect(result.data!.input.workspace.name).toBe('Test Workspace')
    expect(result.data!.html).toContain('<!DOCTYPE html>')
    expect(result.data!.html).toContain('Test cycle')
  })

  it('SEALED cycle with snapshots hydrates evidenceSnapshots + renders seal block', async () => {
    vi.mocked(getCycleById).mockResolvedValue({
      success: true,
      data: {
        cycle: makeCycle({
          status: 'SEALED',
          sealHash:
            'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
          sealedAt: new Date('2026-04-01T14:30:00.000Z'),
          sealedBy: { id: USER_ID, name: 'Sealer' },
        }),
      },
    })
    vi.mocked(prisma.complianceEvidenceSnapshot.findMany).mockResolvedValue([
      {
        id: 'ssss1111-1111-4111-8111-111111111111',
        cycle_id: CYCLE_ID,
        law_list_item_id: null,
        requirement_id: null,
        evidence_kind: 'FILE',
        evidence_file_id: 'ffff1111-1111-4111-8111-111111111111',
        evidence_document_id: null,
        evidence_sha256:
          '0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff',
        captured_at: new Date('2026-04-01T14:30:00.000Z'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evidence_file: {
          id: 'ffff1111-1111-4111-8111-111111111111',
          filename: 'evidence.pdf',
        },
        evidence_document: null,
      } as unknown as Awaited<
        ReturnType<typeof prisma.complianceEvidenceSnapshot.findMany>
      >[number],
    ])

    const result = await getRevisionsrapportInput({ cycleId: CYCLE_ID })

    expect(result.success).toBe(true)
    expect(result.data!.input.snapshots).toHaveLength(1)
    expect(result.data!.input.snapshots[0]!.displayName).toBe('evidence.pdf')
    expect(result.data!.html).toContain('class="seal-block"')
    expect(result.data!.html).toContain(
      'abc123def456abc123def456abc123def456abc123def456abc123def456abcd'
    )
  })

  it('PLANERAD cycle still returns success; client component decides whether to call', async () => {
    vi.mocked(getCycleById).mockResolvedValue({
      success: true,
      data: { cycle: makeCycle({ status: 'PLANERAD' }) },
    })
    vi.mocked(getCycleItemsForCycle).mockResolvedValue(
      makeItemsResult([], 'PLANERAD')
    )

    const result = await getRevisionsrapportInput({ cycleId: CYCLE_ID })

    expect(result.success).toBe(true)
    expect(result.data!.input.cycle.status).toBe('PLANERAD')
    expect(result.data!.html).toContain('<!DOCTYPE html>')
  })
})

// ============================================================================
// Error paths
// ============================================================================

describe('getRevisionsrapportInput — error paths', () => {
  it('propagates getCycleById failure (cross-workspace / not-found)', async () => {
    vi.mocked(getCycleById).mockResolvedValue({
      success: false,
      error: 'Kontrollen hittades inte',
    })

    const result = await getRevisionsrapportInput({ cycleId: CYCLE_ID })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Kontrollen hittades inte')
  })

  it('permission denied — AUDITOR with neither activity:view nor tasks:edit', async () => {
    // Force an empty permission set so neither hasPermission branch succeeds.
    mockWorkspaceCtx({ role: 'AUDITOR', permissions: ['read'] })

    const result = await getRevisionsrapportInput({ cycleId: CYCLE_ID })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Behörighet saknas')
    // No downstream calls after permission failure (short-circuits).
    expect(vi.mocked(getCycleById)).not.toHaveBeenCalled()
  })

  it('AUDITOR with activity:view IS allowed (FR16 read access)', async () => {
    mockWorkspaceCtx({ role: 'AUDITOR' })
    const result = await getRevisionsrapportInput({ cycleId: CYCLE_ID })
    expect(result.success).toBe(true)
  })

  it('zod validation — non-UUID cycleId short-circuits before any call', async () => {
    const result = await getRevisionsrapportInput({ cycleId: 'not-a-uuid' })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(vi.mocked(getCycleById)).not.toHaveBeenCalled()
    expect(
      vi.mocked(prisma.complianceEvidenceSnapshot.findMany)
    ).not.toHaveBeenCalled()
  })

  it('propagates getCycleItemsForCycle failure', async () => {
    vi.mocked(getCycleItemsForCycle).mockResolvedValue({
      success: false,
      error: 'Kunde inte hämta kontrollens dokument',
    })

    const result = await getRevisionsrapportInput({ cycleId: CYCLE_ID })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Kunde inte hämta kontrollens dokument')
  })

  it('propagates listFindingsForCycle failure', async () => {
    vi.mocked(listFindingsForCycle).mockResolvedValue({
      success: false,
      error: 'Kunde inte hämta anmärkningar',
    })

    const result = await getRevisionsrapportInput({ cycleId: CYCLE_ID })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Kunde inte hämta anmärkningar')
  })
})

// ============================================================================
// Tenant isolation
// ============================================================================

describe('getRevisionsrapportInput — tenant isolation', () => {
  it('evidence-snapshot query includes the workspace filter on the cycle join', async () => {
    await getRevisionsrapportInput({ cycleId: CYCLE_ID })
    expect(
      vi.mocked(prisma.complianceEvidenceSnapshot.findMany)
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cycle_id: CYCLE_ID,
          cycle: { workspace_id: WORKSPACE_ID },
        }),
      })
    )
  })
})

// ============================================================================
// Determinism at action layer
// ============================================================================

describe('getRevisionsrapportInput — determinism', () => {
  it('two identical calls with a stubbed clock produce identical HTML', async () => {
    const fixedIso = '2026-04-23T08:00:00.000Z'
    vi.useFakeTimers()
    vi.setSystemTime(new Date(fixedIso))

    try {
      const a = await getRevisionsrapportInput({ cycleId: CYCLE_ID })
      const b = await getRevisionsrapportInput({ cycleId: CYCLE_ID })

      expect(a.success).toBe(true)
      expect(b.success).toBe(true)
      expect(a.data!.html).toBe(b.data!.html)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ============================================================================
// Story 21.12 — reportNeedsRegeneration (pure function)
// ============================================================================

describe('reportNeedsRegeneration', () => {
  const baseGeneratedAt = new Date('2026-04-01T00:00:00.000Z')

  it('null report → true (never generated)', () => {
    expect(reportNeedsRegeneration(null, null)).toBe(true)
    expect(reportNeedsRegeneration(null, Date.now())).toBe(true)
  })

  it('report with null pdf_storage_path → true (e.g. post-seal, pre-PDF)', () => {
    expect(
      reportNeedsRegeneration(
        {
          pdf_storage_path: null,
          report_kind: 'SEALED',
          generated_at: baseGeneratedAt,
        },
        null
      )
    ).toBe(true)
  })

  it('SEALED with populated path → false regardless of touch timestamp', () => {
    expect(
      reportNeedsRegeneration(
        {
          pdf_storage_path: 'path/report.pdf',
          report_kind: 'SEALED',
          generated_at: baseGeneratedAt,
        },
        Date.now() + 100_000 // Even if touch is newer, SEALED is frozen.
      )
    ).toBe(false)
  })

  it('COMPLETE with touch newer than generated_at → true', () => {
    expect(
      reportNeedsRegeneration(
        {
          pdf_storage_path: 'path/report.pdf',
          report_kind: 'COMPLETE',
          generated_at: baseGeneratedAt,
        },
        baseGeneratedAt.getTime() + 60_000 // 1 min later
      )
    ).toBe(true)
  })

  it('COMPLETE with touch older than generated_at → false', () => {
    expect(
      reportNeedsRegeneration(
        {
          pdf_storage_path: 'path/report.pdf',
          report_kind: 'COMPLETE',
          generated_at: baseGeneratedAt,
        },
        baseGeneratedAt.getTime() - 60_000 // 1 min before
      )
    ).toBe(false)
  })

  it('COMPLETE with null mostRecentTouch → false (nothing to compare)', () => {
    expect(
      reportNeedsRegeneration(
        {
          pdf_storage_path: 'path/report.pdf',
          report_kind: 'COMPLETE',
          generated_at: baseGeneratedAt,
        },
        null
      )
    ).toBe(false)
  })
})

// ============================================================================
// Story 21.12 — generateCycleReport
// ============================================================================

interface MockStorageResponse {
  data: unknown
  error: unknown
}

function mockStorageClient(
  pdfResponse: MockStorageResponse = { data: { path: 'x' }, error: null },
  htmlResponse: MockStorageResponse = { data: { path: 'x' }, error: null }
) {
  const upload = vi
    .fn()
    .mockImplementationOnce(() => Promise.resolve(pdfResponse))
    .mockImplementationOnce(() => Promise.resolve(htmlResponse))
  vi.mocked(getStorageClient).mockReturnValue({
    storage: {
      from: vi.fn(() => ({ upload })),
    },
  } as unknown as ReturnType<typeof getStorageClient>)
  return upload
}

describe('generateCycleReport', () => {
  const GENERATED_AT = '2026-04-24T12:00:00.000Z'

  beforeEach(() => {
    // Defaults: cycle exists + is AVSLUTAD, upload succeeds, no existing report.
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      id: CYCLE_ID,
      status: 'AVSLUTAD',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(prisma.complianceAuditReport.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.complianceAuditReport.upsert).mockResolvedValue({
      id: 'rrr11111-1111-4111-8111-111111111111',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(renderRevisionsrapportPdf).mockResolvedValue(
      Buffer.from('pdf-bytes')
    )
    mockStorageClient()
    // getRevisionsrapportInput indirect dependencies reset in top-level beforeEach.
  })

  it('zod validation — non-UUID cycleId short-circuits', async () => {
    const result = await generateCycleReport({
      cycleId: 'not-a-uuid',
      kind: 'COMPLETE',
    })
    expect(result.success).toBe(false)
    expect(
      vi.mocked(prisma.complianceAuditCycle.findFirst)
    ).not.toHaveBeenCalled()
  })

  it('zod validation — invalid kind', async () => {
    const result = await generateCycleReport({
      cycleId: CYCLE_ID,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      kind: 'DRAFT' as any,
    })
    expect(result.success).toBe(false)
  })

  it('permission denied — role without tasks:edit', async () => {
    mockWorkspaceCtx({ role: 'AUDITOR' }) // read+activity:view, no tasks:edit
    await expect(
      generateCycleReport({ cycleId: CYCLE_ID, kind: 'COMPLETE' })
    ).resolves.toMatchObject({ success: false })
  })

  it('PLANERAD cycle — rejected with Swedish error', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      id: CYCLE_ID,
      status: 'PLANERAD',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await generateCycleReport({
      cycleId: CYCLE_ID,
      kind: 'COMPLETE',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('innan kontrollen är slutförd')
  })

  it('PAGAENDE cycle — same rejection', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      id: CYCLE_ID,
      status: 'PAGAENDE',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await generateCycleReport({
      cycleId: CYCLE_ID,
      kind: 'COMPLETE',
    })

    expect(result.success).toBe(false)
  })

  it('SEALED kind on a non-sealed cycle — rejected', async () => {
    // Cycle is AVSLUTAD (default), kind is SEALED → mismatch.
    const result = await generateCycleReport({
      cycleId: CYCLE_ID,
      kind: 'SEALED',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('fastställda')
  })

  it('cycle not found (cross-workspace) → Swedish error', async () => {
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)

    const result = await generateCycleReport({
      cycleId: CYCLE_ID,
      kind: 'COMPLETE',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Kontrollen hittades inte')
  })

  it('happy path COMPLETE — uploads both files, upserts row, logs activity', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(GENERATED_AT))

    try {
      const upload = mockStorageClient()
      const result = await generateCycleReport({
        cycleId: CYCLE_ID,
        kind: 'COMPLETE',
      })

      expect(result.success).toBe(true)
      expect(result.data?.pdfStoragePath).toContain(
        `compliance-audit-reports/${WORKSPACE_ID}/${CYCLE_ID}/report-`
      )
      expect(result.data?.pdfStoragePath).toMatch(/-complete\.pdf$/)
      expect(result.data?.htmlStoragePath).toMatch(/-complete\.html$/)

      // Two storage uploads (PDF + HTML).
      expect(upload).toHaveBeenCalledTimes(2)

      // Upsert called with create branch (no existing row).
      expect(
        vi.mocked(prisma.complianceAuditReport.upsert)
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            cycle_id_report_kind: {
              cycle_id: CYCLE_ID,
              report_kind: 'COMPLETE',
            },
          },
          create: expect.objectContaining({
            cycle_id: CYCLE_ID,
            report_kind: 'COMPLETE',
            pdf_storage_path: expect.stringContaining('-complete.pdf'),
            html_storage_path: expect.stringContaining('-complete.html'),
            manifest: expect.any(Object),
          }),
        })
      )

      // Activity log emitted with entity_type = cycle.
      expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
        WORKSPACE_ID,
        USER_ID,
        'compliance_audit_cycle',
        CYCLE_ID,
        'cycle_report_generated',
        expect.objectContaining({ pdfStoragePath: null }),
        expect.objectContaining({
          pdfStoragePath: expect.stringContaining('-complete.pdf'),
          kind: 'COMPLETE',
        })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('happy path SEALED — manifest omitted from update branch (invariant)', async () => {
    // Cycle is SEALED for this test.
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      id: CYCLE_ID,
      status: 'SEALED',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(getCycleById).mockResolvedValue({
      success: true,
      data: {
        cycle: makeCycle({
          status: 'SEALED',
          sealHash: 'abc'.padEnd(64, '0'),
          sealedAt: new Date('2026-04-01T14:30:00.000Z'),
          sealedBy: { id: USER_ID, name: 'Sealer' },
        }),
      },
    })
    // Existing SEALED row (from seal transaction — manifest already set).
    vi.mocked(prisma.complianceAuditReport.findUnique).mockResolvedValue({
      id: 'rrr11111-1111-4111-8111-111111111111',
      pdf_storage_path: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await generateCycleReport({
      cycleId: CYCLE_ID,
      kind: 'SEALED',
    })

    expect(result.success).toBe(true)

    // CRITICAL INVARIANT: update branch for SEALED has NO `manifest` key.
    const upsertCall = vi.mocked(prisma.complianceAuditReport.upsert).mock
      .calls[0]?.[0]
    expect(upsertCall?.update).toBeDefined()
    expect(upsertCall?.update).not.toHaveProperty('manifest')
    expect(upsertCall?.update).toHaveProperty('pdf_storage_path')
    expect(upsertCall?.update).toHaveProperty('html_storage_path')
    expect(upsertCall?.update).toHaveProperty('generated_at')
  })

  it('storage upload failure — returns Swedish error, no DB write', async () => {
    mockStorageClient(
      { data: null, error: { message: 'upload failed' } },
      { data: { path: 'x' }, error: null }
    )

    const result = await generateCycleReport({
      cycleId: CYCLE_ID,
      kind: 'COMPLETE',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('PDF')
    expect(
      vi.mocked(prisma.complianceAuditReport.upsert)
    ).not.toHaveBeenCalled()
    expect(vi.mocked(logActivity)).not.toHaveBeenCalled()
  })

  it('Puppeteer render failure — propagates to structured error, no uploads', async () => {
    vi.mocked(renderRevisionsrapportPdf).mockRejectedValue(
      new Error('chromium crashed')
    )
    const upload = mockStorageClient()

    const result = await generateCycleReport({
      cycleId: CYCLE_ID,
      kind: 'COMPLETE',
    })

    expect(result.success).toBe(false)
    expect(upload).not.toHaveBeenCalled()
    expect(
      vi.mocked(prisma.complianceAuditReport.upsert)
    ).not.toHaveBeenCalled()
  })

  it('regeneration — previous pdf path surfaced in activity log old_value', async () => {
    vi.mocked(prisma.complianceAuditReport.findUnique).mockResolvedValue({
      id: 'rrr11111-1111-4111-8111-111111111111',
      pdf_storage_path: 'old-path/report-old.pdf',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    await generateCycleReport({ cycleId: CYCLE_ID, kind: 'COMPLETE' })

    expect(vi.mocked(logActivity)).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'compliance_audit_cycle',
      CYCLE_ID,
      'cycle_report_generated',
      { pdfStoragePath: 'old-path/report-old.pdf' },
      expect.any(Object)
    )
  })
})

// ============================================================================
// Story 21.12 — shouldRegenerateReport wrapper
// ============================================================================

describe('shouldRegenerateReport', () => {
  it('no report + no touch → true', async () => {
    vi.mocked(prisma.complianceAuditReport.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.complianceFinding.findFirst).mockResolvedValue(null)

    const result = await shouldRegenerateReport(
      CYCLE_ID,
      WORKSPACE_ID,
      'COMPLETE'
    )

    expect(result).toBe(true)
  })

  it('SEALED report with populated path → false even if items are newer', async () => {
    vi.mocked(prisma.complianceAuditReport.findUnique).mockResolvedValue({
      pdf_storage_path: 'path/report.pdf',
      report_kind: 'SEALED',
      generated_at: new Date('2026-04-01T00:00:00.000Z'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(prisma.complianceAuditCycle.findFirst).mockResolvedValue({
      updated_at: new Date('2026-05-01T00:00:00.000Z'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(prisma.complianceAuditItem.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.complianceFinding.findFirst).mockResolvedValue(null)

    const result = await shouldRegenerateReport(
      CYCLE_ID,
      WORKSPACE_ID,
      'SEALED'
    )

    expect(result).toBe(false)
  })
})
