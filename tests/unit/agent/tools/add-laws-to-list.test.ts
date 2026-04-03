import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

import { createAddLawsToListTool } from '@/lib/agent/tools/add-laws-to-list'

const WORKSPACE_ID = 'ws-test-123'
const USER_ID = 'user-test-456'

function makeExecuteArgs() {
  return {
    toolCallId: 'tc-1',
    messages: [],
    abortSignal: undefined as unknown as AbortSignal,
  }
}

describe('add_laws_to_list tool', () => {
  const tool = createAddLawsToListTool(WORKSPACE_ID, USER_ID)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates list, groups, and items in a transaction', async () => {
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => unknown) => {
        const tx = {
          legalDocument: {
            findMany: vi
              .fn()
              .mockResolvedValue([{ id: 'doc-1' }, { id: 'doc-2' }]),
          },
          lawList: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'list-1' }),
          },
          lawListItem: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            createMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          lawListGroup: {
            findUnique: vi.fn().mockResolvedValue(null),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi
              .fn()
              .mockResolvedValueOnce({ id: 'grp-1', position: 1 })
              .mockResolvedValueOnce({ id: 'grp-2', position: 2 }),
          },
        }
        return fn(tx)
      }
    )

    const result = await tool.execute(
      {
        laws: [
          {
            documentId: 'doc-1',
            businessContext: 'Relevant för er verksamhet',
            group: 'Arbetsrätt',
          },
          {
            documentId: 'doc-2',
            businessContext: 'Gäller alla företag',
            group: 'Bolagsrätt',
          },
        ],
      },
      makeExecuteArgs()
    )

    expect(result).toMatchObject({
      data: {
        listId: 'list-1',
        addedCount: 2,
        skippedCount: 0,
        groups: ['Arbetsrätt', 'Bolagsrätt'],
      },
      _meta: expect.objectContaining({
        tool: 'add_laws_to_list',
      }),
    })
  })

  it('skips duplicate documents', async () => {
    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => unknown) => {
        const tx = {
          legalDocument: {
            findMany: vi
              .fn()
              .mockResolvedValue([{ id: 'doc-1' }, { id: 'doc-2' }]),
          },
          lawList: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ id: 'list-1', is_default: true }),
          },
          lawListItem: {
            findMany: vi.fn().mockResolvedValue([{ document_id: 'doc-1' }]),
            findFirst: vi.fn().mockResolvedValue(null),
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          lawListGroup: {
            findUnique: vi
              .fn()
              .mockResolvedValue({ id: 'grp-1', name: 'Arbetsrätt' }),
            findFirst: vi.fn().mockResolvedValue(null),
          },
        }
        return fn(tx)
      }
    )

    const result = await tool.execute(
      {
        laws: [
          {
            documentId: 'doc-1',
            businessContext: 'Duplicate',
            group: 'Arbetsrätt',
          },
          {
            documentId: 'doc-2',
            businessContext: 'New one',
            group: 'Arbetsrätt',
          },
        ],
      },
      makeExecuteArgs()
    )

    expect(result).toMatchObject({
      data: {
        listId: 'list-1',
        addedCount: 1,
        skippedCount: 1,
      },
    })
  })

  it('returns empty result for empty input', async () => {
    const result = await tool.execute({ laws: [] }, makeExecuteArgs())

    expect(result).toMatchObject({
      data: {
        listId: null,
        addedCount: 0,
        skippedCount: 0,
        groups: [],
      },
    })

    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('handles source as ONBOARDING', async () => {
    let createManyData: unknown[] = []

    mockTransaction.mockImplementation(
      async (fn: (_tx: unknown) => unknown) => {
        const tx = {
          legalDocument: {
            findMany: vi.fn().mockResolvedValue([{ id: 'doc-1' }]),
          },
          lawList: {
            findFirst: vi.fn().mockResolvedValue({ id: 'list-1' }),
          },
          lawListItem: {
            findMany: vi.fn().mockResolvedValue([]),
            findFirst: vi.fn().mockResolvedValue(null),
            createMany: vi
              .fn()
              .mockImplementation(({ data }: { data: unknown[] }) => {
                createManyData = data
                return { count: data.length }
              }),
          },
          lawListGroup: {
            findUnique: vi
              .fn()
              .mockResolvedValue({ id: 'grp-1', name: 'Skatt' }),
            findFirst: vi.fn().mockResolvedValue(null),
          },
        }
        return fn(tx)
      }
    )

    await tool.execute(
      {
        laws: [
          {
            documentId: 'doc-1',
            businessContext: 'Skattelag',
            group: 'Skatt',
          },
        ],
      },
      makeExecuteArgs()
    )

    expect(createManyData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'ONBOARDING',
          compliance_status: 'EJ_PABORJAD',
          added_by: USER_ID,
        }),
      ])
    )
  })

  it('returns error on database failure', async () => {
    mockTransaction.mockRejectedValue(new Error('Transaction failed'))

    const result = await tool.execute(
      {
        laws: [
          {
            documentId: 'doc-1',
            businessContext: 'Test',
            group: 'Test',
          },
        ],
      },
      makeExecuteArgs()
    )

    expect(result).toMatchObject({
      error: true,
      message: expect.stringContaining('Transaction failed'),
    })
  })
})
