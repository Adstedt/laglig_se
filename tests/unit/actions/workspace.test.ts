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

vi.mock('@/lib/cache/workspace-cache', () => ({
  invalidateWorkspaceCache: vi.fn().mockResolvedValue(undefined),
  invalidateUserCache: vi.fn().mockResolvedValue(undefined),
}))

// Story 5.12: mock the Enterprise inquiry email path.
vi.mock('@/lib/email/email-service', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/emails/enterprise-inquiry', () => ({
  EnterpriseInquiryEmail: vi.fn(() => null),
}))

vi.mock('@/lib/env', () => ({
  env: {
    SALES_NOTIFICATION_EMAIL: 'sales@laglig.se',
  },
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

  /**
   * Story 5.12: tier-picker writes to Workspace.trial_picked_tier.
   * Enterprise picks downgrade trial limits to TEAM + set
   * enterprise_inquiry_at for sales follow-up.
   */
  describe('Story 5.12: pickedTier mapping', () => {
    it('pickedTier=SOLO → trial_picked_tier=SOLO, enterprise_inquiry_at unset, no email', async () => {
      const { sendEmail } = await import('@/lib/email/email-service')
      const captureBox: { value: Record<string, unknown> } = { value: {} }
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          workspace: {
            create: vi.fn().mockImplementation((data) => {
              captureBox.value = data.data
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
      formData.append('name', 'My Solo Co')
      formData.append('pickedTier', 'SOLO')

      const result = await createWorkspace(formData)

      expect(result.success).toBe(true)
      expect(captureBox.value.trial_picked_tier).toBe('SOLO')
      expect(captureBox.value.enterprise_inquiry_at).toBeUndefined()
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('pickedTier=TEAM → trial_picked_tier=TEAM, enterprise_inquiry_at unset, no email', async () => {
      const { sendEmail } = await import('@/lib/email/email-service')
      const captureBox: { value: Record<string, unknown> } = { value: {} }
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          workspace: {
            create: vi.fn().mockImplementation((data) => {
              captureBox.value = data.data
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
      formData.append('name', 'Team Co')
      formData.append('pickedTier', 'TEAM')

      await createWorkspace(formData)

      expect(captureBox.value.trial_picked_tier).toBe('TEAM')
      expect(captureBox.value.enterprise_inquiry_at).toBeUndefined()
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('pickedTier=ENTERPRISE → trial_picked_tier=TEAM, enterprise_inquiry_at set, sendEmail fired', async () => {
      const { sendEmail } = await import('@/lib/email/email-service')
      const captureBox: { value: Record<string, unknown> } = { value: {} }
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          workspace: {
            create: vi.fn().mockImplementation((data) => {
              captureBox.value = data.data
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
      formData.append('name', 'Big Co')
      formData.append('pickedTier', 'ENTERPRISE')

      await createWorkspace(formData)

      expect(captureBox.value.trial_picked_tier).toBe('TEAM')
      expect(captureBox.value.enterprise_inquiry_at).toBeInstanceOf(Date)
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sales@laglig.se',
          subject: expect.stringContaining('Big Co'),
          from: 'notifications',
        })
      )
    })

    it('missing pickedTier defaults to SOLO and emits a console.warn', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const captureBox: { value: Record<string, unknown> } = { value: {} }
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          workspace: {
            create: vi.fn().mockImplementation((data) => {
              captureBox.value = data.data
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
      formData.append('name', 'Unspecified Co')
      // no pickedTier

      await createWorkspace(formData)

      expect(captureBox.value.trial_picked_tier).toBe('SOLO')
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing or invalid pickedTier')
      )
      warnSpy.mockRestore()
    })

    it('sendEmail throwing does NOT roll back the workspace; logs [ENTERPRISE_INQUIRY_EMAIL_FAIL]', async () => {
      const { sendEmail } = await import('@/lib/email/email-service')
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Resend down'))

      const formData = new FormData()
      formData.append('name', 'Big Co')
      formData.append('pickedTier', 'ENTERPRISE')

      const result = await createWorkspace(formData)

      // Workspace create still succeeds — email is post-tx fail-safe.
      expect(result.success).toBe(true)
      expect(errSpy).toHaveBeenCalledWith(
        '[ENTERPRISE_INQUIRY_EMAIL_FAIL]',
        expect.any(Error)
      )
      errSpy.mockRestore()
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
