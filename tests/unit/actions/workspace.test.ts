/**
 * Story 5.9: Tests for workspace server actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    workspace: {
      create: vi.fn(),
    },
    workspaceMember: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth/session', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  setActiveWorkspace: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createWorkspace } from '@/app/actions/workspace'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth/session'
import { setActiveWorkspace } from '@/lib/auth/workspace-context'
import { revalidatePath } from 'next/cache'

const mockSession = {
  user: {
    email: 'test@example.com',
    name: 'Test User',
  },
}

const mockUser = {
  id: 'user_123',
  email: 'test@example.com',
  name: 'Test User',
}

const mockWorkspace = {
  id: 'ws_123',
  name: 'New Workspace',
  slug: 'new-workspace-abc123',
  owner_id: 'user_123',
  subscription_tier: 'TRIAL',
  status: 'ACTIVE',
}

describe('createWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        workspace: {
          create: vi.fn().mockResolvedValue(mockWorkspace),
        },
        workspaceMember: {
          create: vi.fn().mockResolvedValue({ id: 'member_123' }),
        },
      }
      return callback(tx as never)
    })
  })

  describe('validation', () => {
    it('requires user to be logged in', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)

      const formData = new FormData()
      formData.append('name', 'Test Workspace')

      const result = await createWorkspace(formData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Du måste vara inloggad')
    })

    it('requires user to exist in database', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const formData = new FormData()
      formData.append('name', 'Test Workspace')

      const result = await createWorkspace(formData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Användare hittades inte')
    })

    it('requires workspace name', async () => {
      const formData = new FormData()
      formData.append('name', '')

      const result = await createWorkspace(formData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Arbetsplatsnamn krävs')
    })

    it('rejects name exceeding 100 characters', async () => {
      const formData = new FormData()
      formData.append('name', 'a'.repeat(101))

      const result = await createWorkspace(formData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Max 100 tecken')
    })
  })

  describe('workspace creation', () => {
    it('creates workspace with correct defaults', async () => {
      const formData = new FormData()
      formData.append('name', 'My Company')

      const result = await createWorkspace(formData)

      expect(result.success).toBe(true)
      expect(result.workspaceId).toBe('ws_123')

      // Verify transaction was called
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('sets user as OWNER in workspace members', async () => {
      let capturedMemberData: Record<string, unknown> | null = null

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          workspace: {
            create: vi.fn().mockResolvedValue(mockWorkspace),
          },
          workspaceMember: {
            create: vi.fn().mockImplementation((data) => {
              capturedMemberData = data.data
              return Promise.resolve({ id: 'member_123' })
            }),
          },
        }
        return callback(tx as never)
      })

      const formData = new FormData()
      formData.append('name', 'My Company')

      await createWorkspace(formData)

      expect(capturedMemberData).toMatchObject({
        user_id: 'user_123',
        role: 'OWNER',
      })
    })

    it('sets workspace as active after creation', async () => {
      const formData = new FormData()
      formData.append('name', 'My Company')

      await createWorkspace(formData)

      expect(setActiveWorkspace).toHaveBeenCalledWith('ws_123')
    })

    it('revalidates path after creation', async () => {
      const formData = new FormData()
      formData.append('name', 'My Company')

      await createWorkspace(formData)

      expect(revalidatePath).toHaveBeenCalledWith('/')
    })

    it('sets trial subscription with 14-day expiry', async () => {
      let capturedWorkspaceData: Record<string, unknown> | null = null

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          workspace: {
            create: vi.fn().mockImplementation((data) => {
              capturedWorkspaceData = data.data
              return Promise.resolve(mockWorkspace)
            }),
          },
          workspaceMember: {
            create: vi.fn().mockResolvedValue({ id: 'member_123' }),
          },
        }
        return callback(tx as never)
      })

      const formData = new FormData()
      formData.append('name', 'My Company')

      await createWorkspace(formData)

      expect(capturedWorkspaceData?.subscription_tier).toBe('TRIAL')
      expect(capturedWorkspaceData?.status).toBe('ACTIVE')
      expect(capturedWorkspaceData?.trial_ends_at).toBeDefined()

      // Verify trial ends in approximately 14 days
      const trialEnd = capturedWorkspaceData?.trial_ends_at as Date
      const now = new Date()
      const diffDays = Math.round(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      expect(diffDays).toBeGreaterThanOrEqual(13)
      expect(diffDays).toBeLessThanOrEqual(15)
    })
  })

  describe('error handling', () => {
    it('handles database errors gracefully', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error('Database error')
      )

      const formData = new FormData()
      formData.append('name', 'My Company')

      const result = await createWorkspace(formData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Något gick fel. Försök igen.')
    })
  })

  describe('slug generation', () => {
    it('generates URL-safe slug from name', async () => {
      let capturedSlug: string | null = null

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          workspace: {
            create: vi.fn().mockImplementation((data) => {
              capturedSlug = data.data.slug
              return Promise.resolve({ ...mockWorkspace, slug: capturedSlug })
            }),
          },
          workspaceMember: {
            create: vi.fn().mockResolvedValue({ id: 'member_123' }),
          },
        }
        return callback(tx as never)
      })

      const formData = new FormData()
      formData.append('name', 'Företag AB & Co')

      await createWorkspace(formData)

      // Should be lowercase, no special chars, with random suffix
      expect(capturedSlug).toMatch(/^foretag-ab-co-[a-z0-9]{6}$/)
    })
  })
})
