/**
 * Unit tests for list_stale_documents (Story 19.3).
 * Asserts: workspace + review_date<now + status notIn retired where, take cap,
 * Swedish status label, daysOverdue, raw documentType, empty-state.
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { workspaceDocument: { count: vi.fn(), findMany: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { createListStaleDocumentsTool } from '@/lib/agent/tools/list-stale-documents'

const docs = (
  prisma as unknown as {
    workspaceDocument: {
      count: ReturnType<typeof vi.fn>
      findMany: ReturnType<typeof vi.fn>
    }
  }
).workspaceDocument
const mockCount = docs.count
const mockFindMany = docs.findMany

const WS = 'ws-1'
type Exec = (
  _i: { limit?: number },
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    title: 'Dataskyddspolicy',
    document_type: 'POLICY',
    status: 'APPROVED',
    review_date: new Date(Date.now() - 10 * 86_400_000), // 10 days overdue
    ...over,
  }
}

const execute = createListStaleDocumentsTool(WS).execute as Exec

beforeEach(() => vi.clearAllMocks())

it('where: workspace + review_date<now + excludes retired; capped', async () => {
  mockCount.mockResolvedValue(1)
  mockFindMany.mockResolvedValue([row()])
  await execute({}, opts)
  const arg = mockFindMany.mock.calls[0][0]
  expect(arg.where.workspace_id).toBe(WS)
  expect(arg.where.review_date.lt).toBeInstanceOf(Date)
  expect(arg.where.status.notIn).toEqual(['SUPERSEDED', 'ARCHIVED'])
  expect(arg.take).toBe(20)
  expect(arg.orderBy).toEqual({ review_date: 'asc' })
})

it('labels status (Swedish), derives daysOverdue, keeps raw documentType', async () => {
  mockCount.mockResolvedValue(1)
  mockFindMany.mockResolvedValue([row()])
  const result = await execute({}, opts)
  const doc = (result.data as { documents: Array<Record<string, unknown>> })
    .documents[0]
  expect(doc.status).toBe('Godkänd') // APPROVED → Swedish label
  expect(doc.documentType).toBe('POLICY') // coarse category, raw enum
  expect(doc.daysOverdue as number).toBeGreaterThanOrEqual(10)
  expect(doc.documentId).toBe('d1')
})

it('empty state → { count: 0, documents: [] }', async () => {
  mockCount.mockResolvedValue(0)
  mockFindMany.mockResolvedValue([])
  const result = await execute({}, opts)
  expect(result.data).toEqual({ count: 0, documents: [] })
})
