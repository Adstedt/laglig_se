/**
 * Story 19.4a — law-item write tools default `lawListItemId` from the chat
 * context when the agent omits the arg, and error (→ search_law_list_items) when
 * neither is present. add_obligation is tested across all three branches;
 * add_context_note + update_compliance_status get a context-default smoke each
 * (they share the identical resolve pattern).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListItem: { findFirst: vi.fn() },
    pendingAgentAction: { create: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { createAddObligationTool } from '@/lib/agent/tools/add-obligation'
import { createAddContextNoteTool } from '@/lib/agent/tools/add-context-note'
import { createUpdateComplianceStatusTool } from '@/lib/agent/tools/update-compliance-status'

const p = prisma as unknown as {
  lawListItem: { findFirst: ReturnType<typeof vi.fn> }
  pendingAgentAction: { create: ReturnType<typeof vi.fn> }
}

const WS = 'ws-1'
type Exec = (
  _i: Record<string, unknown>,
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

beforeEach(() => {
  vi.clearAllMocks()
  p.lawListItem.findFirst.mockResolvedValue({
    id: 'resolved',
    document: { title: 'Arbetsmiljölag', document_number: 'SFS 1977:1160' },
    compliance_status: 'EJ_PABORJAD',
  })
  p.pendingAgentAction.create.mockResolvedValue({ id: 'pa-1' })
})

describe('add_obligation — lawListItemId resolution (Story 19.4a)', () => {
  it('explicit arg wins over context default', async () => {
    const tool = createAddObligationTool(WS, {
      userId: 'u',
      lawListItemId: 'ctx-1',
    })
    await (tool.execute as Exec)(
      { lawListItemId: 'explicit-1', text: 'krav' },
      opts
    )
    expect(p.lawListItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'explicit-1', law_list: { workspace_id: WS } },
      })
    )
  })

  it('falls back to context.lawListItemId when arg omitted', async () => {
    const tool = createAddObligationTool(WS, {
      userId: 'u',
      lawListItemId: 'ctx-1',
    })
    await (tool.execute as Exec)({ text: 'krav' }, opts)
    expect(p.lawListItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ctx-1', law_list: { workspace_id: WS } },
      })
    )
  })

  it('neither arg nor context → wrapToolError, no DB lookup', async () => {
    const tool = createAddObligationTool(WS, { userId: 'u' })
    const result = await (tool.execute as Exec)({ text: 'krav' }, opts)
    expect(result.error).toBe(true)
    expect(p.lawListItem.findFirst).not.toHaveBeenCalled()
  })
})

it('add_context_note falls back to context.lawListItemId', async () => {
  const tool = createAddContextNoteTool(WS, {
    userId: 'u',
    lawListItemId: 'ctx-2',
  })
  await (tool.execute as Exec)({ note: 'relevant' }, opts)
  expect(p.lawListItem.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'ctx-2', law_list: { workspace_id: WS } },
    })
  )
})

it('update_compliance_status falls back to context.lawListItemId', async () => {
  const tool = createUpdateComplianceStatusTool(WS, {
    userId: 'u',
    lawListItemId: 'ctx-3',
  })
  await (tool.execute as Exec)({ newStatus: 'UPPFYLLD', reason: 'klart' }, opts)
  expect(p.lawListItem.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'ctx-3', law_list: { workspace_id: WS } },
    })
  )
})

it('update_compliance_status with neither → wrapToolError', async () => {
  const tool = createUpdateComplianceStatusTool(WS, { userId: 'u' })
  const result = await (tool.execute as Exec)(
    { newStatus: 'UPPFYLLD', reason: 'klart' },
    opts
  )
  expect(result.error).toBe(true)
  expect(p.lawListItem.findFirst).not.toHaveBeenCalled()
})
