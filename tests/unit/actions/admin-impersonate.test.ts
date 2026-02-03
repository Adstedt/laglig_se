import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/admin/auth', () => ({
  getAdminSession: vi.fn(),
  getNextAuthCookieName: vi.fn(() => 'next-auth.session-token'),
  isImpersonating: vi.fn(),
}))

vi.mock('next-auth/jwt', () => ({
  encode: vi.fn(),
  decode: vi.fn(),
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  ACTIVE_WORKSPACE_COOKIE: 'active_workspace_id',
}))

import { prisma } from '@/lib/prisma'
import { getAdminSession, isImpersonating } from '@/lib/admin/auth'
import { encode, decode } from 'next-auth/jwt'
import {
  startImpersonation,
  endImpersonation,
} from '@/app/actions/admin-impersonate'

const mockAdmin = { email: 'admin@test.com' }
const mockUser = {
  id: 'user-123',
  email: 'user@test.com',
  name: 'Test User',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCookieStore.get.mockReturnValue(undefined)
  mockCookieStore.set.mockReturnValue(undefined)
})

// --- startImpersonation ---

describe('startImpersonation', () => {
  it('rejects without admin session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null)

    const result = await startImpersonation('user-123')

    expect(result).toEqual({
      success: false,
      error: 'Admin session required',
    })
  })

  it('rejects for non-existent user', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockAdmin)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never)

    const result = await startImpersonation('nonexistent')

    expect(result).toEqual({ success: false, error: 'User not found' })
  })

  it('rejects self-impersonation', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockAdmin)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin-user-id',
      email: 'admin@test.com',
      name: 'Admin',
    } as never)

    const result = await startImpersonation('admin-user-id')

    expect(result).toEqual({
      success: false,
      error: 'Cannot impersonate yourself',
    })
  })

  it('rejects when already impersonating', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockAdmin)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(isImpersonating).mockResolvedValue(true)

    const result = await startImpersonation('user-123')

    expect(result).toEqual({
      success: false,
      error: 'Already impersonating a user. Return to admin first.',
    })
  })

  it('calls encode from next-auth/jwt with correct token payload', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockAdmin)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(isImpersonating).mockResolvedValue(false)
    vi.mocked(encode).mockResolvedValue('encoded-token' as never)
    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as never)

    process.env.NEXTAUTH_SECRET = 'test-secret'

    await startImpersonation('user-123')

    expect(encode).toHaveBeenCalledWith({
      token: {
        id: 'user-123',
        email: 'user@test.com',
        name: 'Test User',
        sub: 'user-123',
      },
      secret: 'test-secret',
      maxAge: 3600,
    })
  })

  it('sets session cookie with correct name and options', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockAdmin)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(isImpersonating).mockResolvedValue(false)
    vi.mocked(encode).mockResolvedValue('encoded-token' as never)
    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as never)

    process.env.NEXTAUTH_SECRET = 'test-secret'

    await startImpersonation('user-123')

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'next-auth.session-token',
      'encoded-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 3600,
      })
    )
  })

  it('creates AdminAuditLog record with IMPERSONATION_START', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockAdmin)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never)
    vi.mocked(isImpersonating).mockResolvedValue(false)
    vi.mocked(encode).mockResolvedValue('encoded-token' as never)
    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as never)

    process.env.NEXTAUTH_SECRET = 'test-secret'

    const result = await startImpersonation('user-123')

    expect(result).toEqual({ success: true })
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        admin_email: 'admin@test.com',
        action: 'IMPERSONATION_START',
        target_type: 'USER',
        target_id: 'user-123',
        metadata: {
          targetEmail: 'user@test.com',
          targetName: 'Test User',
        },
      },
    })
  })
})

// --- endImpersonation ---

describe('endImpersonation', () => {
  it('rejects without admin session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null)

    const result = await endImpersonation()

    expect(result).toEqual({
      success: false,
      error: 'Admin session required',
    })
  })

  it('clears session cookie and active_workspace_id cookie', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockAdmin)
    mockCookieStore.get.mockReturnValue({ value: 'some-token' })
    vi.mocked(decode).mockResolvedValue({
      id: 'user-123',
      email: 'user@test.com',
    } as never)
    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as never)

    process.env.NEXTAUTH_SECRET = 'test-secret'

    await endImpersonation()

    // Session cookie cleared
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'next-auth.session-token',
      '',
      expect.objectContaining({ maxAge: 0 })
    )
    // Workspace cookie cleared
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'active_workspace_id',
      '',
      expect.objectContaining({ maxAge: 0 })
    )
  })

  it('creates AdminAuditLog record with IMPERSONATION_END', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockAdmin)
    mockCookieStore.get.mockReturnValue({ value: 'some-token' })
    vi.mocked(decode).mockResolvedValue({
      id: 'user-123',
      email: 'user@test.com',
    } as never)
    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as never)

    process.env.NEXTAUTH_SECRET = 'test-secret'

    await endImpersonation()

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        admin_email: 'admin@test.com',
        action: 'IMPERSONATION_END',
        target_type: 'USER',
        target_id: 'user-123',
        metadata: { impersonatedUserId: 'user-123' },
      },
    })
  })

  it('returns the impersonated user ID', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(mockAdmin)
    mockCookieStore.get.mockReturnValue({ value: 'some-token' })
    vi.mocked(decode).mockResolvedValue({
      id: 'user-123',
      email: 'user@test.com',
    } as never)
    vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as never)

    process.env.NEXTAUTH_SECRET = 'test-secret'

    const result = await endImpersonation()

    expect(result).toEqual({ success: true, userId: 'user-123' })
  })
})
