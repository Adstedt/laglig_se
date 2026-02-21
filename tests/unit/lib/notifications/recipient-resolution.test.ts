import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { resolveAffectedRecipients } from '@/lib/notifications/recipient-resolution'

const DOCUMENT_ID = 'doc-123'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveAffectedRecipients', () => {
  it('returns recipients from multiple workspaces tracking the document', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      {
        id: 'ws-1',
        name: 'Workspace A',
        members: [
          { user: { id: 'user-1', email: 'a@test.com', name: 'Alice' } },
          { user: { id: 'user-2', email: 'b@test.com', name: 'Bob' } },
          { user: { id: 'user-3', email: 'c@test.com', name: null } },
        ],
      },
      {
        id: 'ws-2',
        name: 'Workspace B',
        members: [
          { user: { id: 'user-4', email: 'd@test.com', name: 'Diana' } },
          { user: { id: 'user-5', email: 'e@test.com', name: 'Eve' } },
          { user: { id: 'user-6', email: 'f@test.com', name: 'Frank' } },
        ],
      },
    ] as never)

    const result = await resolveAffectedRecipients(DOCUMENT_ID)

    expect(result).toHaveLength(6)
    expect(result[0]).toEqual({
      userId: 'user-1',
      email: 'a@test.com',
      name: 'Alice',
      workspaceId: 'ws-1',
      workspaceName: 'Workspace A',
    })
  })

  it('returns empty array when document is not in any law list', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([])

    const result = await resolveAffectedRecipients(DOCUMENT_ID)

    expect(result).toEqual([])
  })

  it('skips workspaces with no members', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      {
        id: 'ws-empty',
        name: 'Empty WS',
        members: [],
      },
      {
        id: 'ws-active',
        name: 'Active WS',
        members: [
          { user: { id: 'user-1', email: 'a@test.com', name: 'Alice' } },
        ],
      },
    ] as never)

    const result = await resolveAffectedRecipients(DOCUMENT_ID)

    expect(result).toHaveLength(1)
    expect(result[0]!.workspaceId).toBe('ws-active')
  })

  it('returns user once per workspace when in multiple workspaces tracking same doc', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      {
        id: 'ws-1',
        name: 'Workspace A',
        members: [
          { user: { id: 'user-1', email: 'a@test.com', name: 'Alice' } },
        ],
      },
      {
        id: 'ws-2',
        name: 'Workspace B',
        members: [
          { user: { id: 'user-1', email: 'a@test.com', name: 'Alice' } },
        ],
      },
    ] as never)

    const result = await resolveAffectedRecipients(DOCUMENT_ID)

    expect(result).toHaveLength(2)
    expect(result[0]!.workspaceId).toBe('ws-1')
    expect(result[1]!.workspaceId).toBe('ws-2')
    expect(result[0]!.userId).toBe('user-1')
    expect(result[1]!.userId).toBe('user-1')
  })

  it('queries with correct Prisma where clause', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([])

    await resolveAffectedRecipients(DOCUMENT_ID)

    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        law_lists: {
          some: {
            items: {
              some: { document_id: DOCUMENT_ID },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        members: {
          select: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    })
  })
})
