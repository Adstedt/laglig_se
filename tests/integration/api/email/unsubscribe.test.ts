import { describe, it, expect, vi, beforeEach } from 'vitest'

const TEST_USER_ID = '11111111-1111-4111-a111-111111111111'
const TEST_WORKSPACE_ID = '22222222-2222-4222-a222-222222222222'
const TEST_SECRET = 'test-secret-for-integration'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificationPreference: {
      upsert: vi.fn().mockResolvedValue({ id: 'pref-1', email_enabled: false }),
    },
  },
}))

// Mock redis/ratelimit to avoid needing real Redis
vi.mock('@/lib/cache/redis', () => ({
  redis: {},
  isRedisConfigured: () => false,
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXTAUTH_SECRET', TEST_SECRET)
})

import { prisma } from '@/lib/prisma'
import { generateUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { POST } from '@/app/api/email/unsubscribe/route'

function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/email/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/email/unsubscribe', () => {
  it('returns 200 and sets email_enabled=false for valid token', async () => {
    const token = generateUnsubscribeToken(TEST_USER_ID, TEST_WORKSPACE_ID)
    const response = await POST(createRequest({ token }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: {
        user_id_workspace_id: {
          user_id: TEST_USER_ID,
          workspace_id: TEST_WORKSPACE_ID,
        },
      },
      update: { email_enabled: false },
      create: {
        user_id: TEST_USER_ID,
        workspace_id: TEST_WORKSPACE_ID,
        email_enabled: false,
      },
    })
  })

  it('returns 400 for invalid token', async () => {
    const response = await POST(createRequest({ token: 'invalid-token' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(prisma.notificationPreference.upsert).not.toHaveBeenCalled()
  })

  it('returns 400 when token is missing', async () => {
    const response = await POST(createRequest({}))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  it('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost:3000/api/email/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })
})
