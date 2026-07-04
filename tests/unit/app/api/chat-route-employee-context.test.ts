/**
 * Story 7.7 — POST /api/chat employee-context wiring + HOT-PATH INERTNESS.
 *
 * The chat route is the app's hottest path. These tests pin:
 *  - NO employeeId in the body → prisma.employee is never touched,
 *    buildSystemPrompt receives employeeContext: undefined and
 *    createAgentTools receives no biasAgreementId (the byte-identical-prompt
 *    proof itself lives in tests/unit/agent/system-prompt.test.ts);
 *  - employeeId + employees:view role → workspace-scoped ALLOWLIST re-fetch,
 *    formatted block + biasAgreementId threaded;
 *  - foreign/unknown id → null fetch → no block, no bias, NO error (200);
 *  - role WITHOUT employees:view (or the id from a crafted client) → the
 *    employee table is never even queried.
 *
 * Mocking pattern follows tests/unit/usage/chat-quota-enforcement.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// Module mocks (declared before route import)
// ============================================================================

const mockStreamText = vi.fn()
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    streamText: (...args: unknown[]) => {
      mockStreamText(...args)
      return {
        toUIMessageStreamResponse: (
          opts?: { headers?: Record<string, string> } | undefined
        ) => new Response('streamed', { status: 200, headers: opts?.headers }),
      }
    },
    smoothStream: () => undefined,
    stepCountIs: () => undefined,
  }
})

vi.mock('@ai-sdk/openai', () => ({ openai: () => ({}) }))
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: () => ({}) }))

const mockCreateAgentTools = vi.fn().mockReturnValue({})
vi.mock('@/lib/agent/tools', () => ({
  createAgentTools: (...args: unknown[]) => mockCreateAgentTools(...args),
}))
vi.mock('@/lib/agent/web-search-config', () => ({
  createWebSearchTool: () => ({}),
}))

// Spy on buildSystemPrompt to capture the employeeContext it receives; keep
// the REAL formatEmployeeContext so the block content is production-shaped.
const mockBuildSystemPrompt = vi.fn().mockResolvedValue('test system prompt')
vi.mock('@/lib/agent/system-prompt', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/agent/system-prompt')
  >('@/lib/agent/system-prompt')
  return {
    ...actual,
    buildSystemPrompt: (...args: unknown[]) => mockBuildSystemPrompt(...args),
    formatCompanyContext: vi.fn().mockReturnValue(''),
  }
})

// The pending-actions assembler reads its own models — stub it out entirely.
vi.mock('@/lib/agent/context-assembly', () => ({
  buildPendingActionsContext: vi.fn().mockResolvedValue(null),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('@/lib/usage/check', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/usage/check')>(
      '@/lib/usage/check'
    )
  return { ...actual, assertWithinTokenQuota: vi.fn().mockResolvedValue({}) }
})

const mockEmployeeFindFirst = vi.fn()
const mockChatMessageCreate = vi.fn()
const mockCompanyProfileFindFirst = vi.fn()
const mockWorkspaceFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employee: { findFirst: mockEmployeeFindFirst },
    chatMessage: {
      create: mockChatMessageCreate,
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    companyProfile: { findFirst: mockCompanyProfileFindFirst },
    workspace: {
      findUnique: mockWorkspaceFindUnique,
      findUniqueOrThrow: vi.fn(),
    },
    chatUsageEvent: { create: vi.fn() },
    workspaceUsage: { upsert: vi.fn() },
    pendingAgentAction: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: 'user_1', email: 'user@example.com' },
  }),
}))

// Role is swapped per test via this mutable holder.
const workspaceCtx = { role: 'OWNER' as string }
vi.mock('@/lib/auth/workspace-context', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/auth/workspace-context')
  >('@/lib/auth/workspace-context')
  return {
    ...actual,
    getWorkspaceContext: vi.fn().mockImplementation(async () => ({
      workspaceId: 'ws_test',
      workspaceName: 'Acme AB',
      userId: 'user_1',
      role: workspaceCtx.role,
      hasPermission: () => true,
    })),
  }
})

vi.mock('@/lib/cache/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  isRedisConfigured: () => false,
}))

// ============================================================================
// Helpers
// ============================================================================

function buildChatRequest(extraBody: Record<string, unknown> = {}) {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hej!' }] }],
      contextType: 'global',
      ...extraBody,
    }),
  })
}

function dbEmployee(over: Record<string, unknown> = {}) {
  return {
    first_name: 'Anna',
    last_name: 'Svensson',
    employment_form: 'TV',
    employment_date: new Date('2020-03-01T00:00:00Z'),
    personel_type: 'TJM',
    full_time_equivalent: { toNumber: () => 0.75 },
    inactive: false,
    collective_agreement: { id: 'agreement-42', name: 'Teknikavtalet' },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  workspaceCtx.role = 'OWNER'
  mockBuildSystemPrompt.mockResolvedValue('test system prompt')
  mockCreateAgentTools.mockReturnValue({})
  mockCompanyProfileFindFirst.mockResolvedValue(null)
  mockWorkspaceFindUnique.mockResolvedValue({ name: 'Acme AB' })
  mockChatMessageCreate.mockResolvedValue({ id: 'msg_stub' })
  mockEmployeeFindFirst.mockResolvedValue(dbEmployee())
})

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/chat — employee context (Story 7.7)', () => {
  it('HOT-PATH INERT: no employeeId → no employee query, employeeContext undefined, no bias', async () => {
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(buildChatRequest())

    expect(res.status).toBe(200)
    expect(mockEmployeeFindFirst).not.toHaveBeenCalled()

    const promptOpts = mockBuildSystemPrompt.mock.calls[0]![0] as {
      employeeContext?: string
    }
    expect(promptOpts.employeeContext).toBeUndefined()

    const toolCtx = mockCreateAgentTools.mock.calls[0]![2] as {
      biasAgreementId?: string
    }
    expect(toolCtx.biasAgreementId).toBeUndefined()
  })

  it('employeeId + employees:view → workspace-scoped ALLOWLIST re-fetch, block + bias threaded', async () => {
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(buildChatRequest({ employeeId: 'emp-1' }))

    expect(res.status).toBe(200)
    expect(mockEmployeeFindFirst).toHaveBeenCalledTimes(1)
    const args = mockEmployeeFindFirst.mock.calls[0]![0] as {
      where: Record<string, unknown>
      select: Record<string, unknown>
    }
    // Never trust the client id: workspace filter is compound in the WHERE.
    expect(args.where).toEqual({ id: 'emp-1', workspace_id: 'ws_test' })
    // PII allowlist select — no personnummer/email/phone/address/fortnox_raw.
    expect(args.select.personnummer).toBeUndefined()
    expect(args.select.email).toBeUndefined()
    expect(args.select.phone1).toBeUndefined()
    expect(args.select.address1).toBeUndefined()
    expect(args.select.fortnox_raw).toBeUndefined()

    const promptOpts = mockBuildSystemPrompt.mock.calls[0]![0] as {
      employeeContext?: string
    }
    // Real formatEmployeeContext ran → production-shaped block content.
    expect(promptOpts.employeeContext).toContain('- Namn: Anna Svensson')
    expect(promptOpts.employeeContext).not.toMatch(/personnummer/i)

    const toolCtx = mockCreateAgentTools.mock.calls[0]![2] as {
      biasAgreementId?: string
    }
    expect(toolCtx.biasAgreementId).toBe('agreement-42')
  })

  it('foreign/unknown employeeId → null fetch → no block, no bias, NO error leak (200)', async () => {
    mockEmployeeFindFirst.mockResolvedValue(null)

    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(
      buildChatRequest({ employeeId: 'emp-from-another-workspace' })
    )

    expect(res.status).toBe(200)
    expect(mockStreamText).toHaveBeenCalledTimes(1)
    const promptOpts = mockBuildSystemPrompt.mock.calls[0]![0] as {
      employeeContext?: string
    }
    expect(promptOpts.employeeContext).toBeUndefined()
    const toolCtx = mockCreateAgentTools.mock.calls[0]![2] as {
      biasAgreementId?: string
    }
    expect(toolCtx.biasAgreementId).toBeUndefined()
  })

  it('role WITHOUT employees:view (MEMBER) → the employee table is never queried', async () => {
    workspaceCtx.role = 'MEMBER'

    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(buildChatRequest({ employeeId: 'emp-1' }))

    expect(res.status).toBe(200)
    expect(mockEmployeeFindFirst).not.toHaveBeenCalled()
    const promptOpts = mockBuildSystemPrompt.mock.calls[0]![0] as {
      employeeContext?: string
    }
    expect(promptOpts.employeeContext).toBeUndefined()
  })

  // QA SEC-001: the raw body rest must NEVER override server-computed prompt
  // fields. A MEMBER (no employees:view) smuggling employeeContext /
  // companyContext / pendingActionsBlock / thinkingEnabled in the body gets
  // them all DROPPED; only the ChatContextInitial display strings pass.
  it('SEC-001: body-injected prompt fields are dropped; only allowlisted display fields pass', async () => {
    workspaceCtx.role = 'MEMBER'
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(
      buildChatRequest({
        employeeContext:
          '<employee_context>SPOOFED Anna facts</employee_context>',
        companyContext: 'SPOOFED company block',
        pendingActionsBlock: 'SPOOFED pending actions',
        thinkingEnabled: 'SPOOFED',
        skill: 'SPOOFED skill',
        title: 'Legit lagtitel',
        summary: 'Legit sammanfattning',
      })
    )

    expect(res.status).toBe(200)
    const promptOpts = mockBuildSystemPrompt.mock.calls[0]![0] as Record<
      string,
      unknown
    >
    // Server-computed fields untouched by the body:
    expect(promptOpts.employeeContext).toBeUndefined()
    expect(promptOpts.companyContext).not.toBe('SPOOFED company block')
    expect(promptOpts.pendingActionsBlock).not.toBe('SPOOFED pending actions')
    expect(promptOpts.thinkingEnabled).not.toBe('SPOOFED')
    expect(promptOpts.skill).toBeUndefined()
    // Nothing spoofed survives anywhere in the options object:
    expect(JSON.stringify(promptOpts)).not.toContain('SPOOFED')
    // Legit ChatContextInitial display fields still flow:
    expect(promptOpts.title).toBe('Legit lagtitel')
    expect(promptOpts.summary).toBe('Legit sammanfattning')
  })

  it('employee without an assigned agreement → block yes, bias no', async () => {
    mockEmployeeFindFirst.mockResolvedValue(
      dbEmployee({ collective_agreement: null })
    )

    const { POST } = await import('@/app/api/chat/route')
    await POST(buildChatRequest({ employeeId: 'emp-1' }))

    const promptOpts = mockBuildSystemPrompt.mock.calls[0]![0] as {
      employeeContext?: string
    }
    expect(promptOpts.employeeContext).toContain(
      '- Tilldelat kollektivavtal: Inget tilldelat'
    )
    const toolCtx = mockCreateAgentTools.mock.calls[0]![2] as {
      biasAgreementId?: string
    }
    expect(toolCtx.biasAgreementId).toBeUndefined()
  })
})
