import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/admin/auth', () => ({
  getAdminSession: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { getAdminSession } from '@/lib/admin/auth'
import { triggerJob } from '@/app/actions/admin-cron'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  process.env.CRON_SECRET = 'test-secret'
})

describe('triggerJob', () => {
  it('rejects without admin session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null)

    const result = await triggerJob('warm-cache')

    expect(result).toEqual({ success: false, error: 'Ej autentiserad' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects for unknown job name', async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ email: 'admin@test.com' })

    const result = await triggerJob('nonexistent-job')

    expect(result).toEqual({ success: false, error: 'Okänt jobb' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calls correct endpoint with correct headers', async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ email: 'admin@test.com' })
    mockFetch.mockResolvedValue(new Response('OK'))

    const result = await triggerJob('warm-cache')

    expect(result).toEqual({ success: true })
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cron/warm-cache',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-secret',
          'x-triggered-by': 'admin@test.com',
        },
      }
    )
  })

  it('calls prewarm-cache endpoint for prewarm-cache job', async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ email: 'admin@test.com' })
    mockFetch.mockResolvedValue(new Response('OK'))

    const result = await triggerJob('prewarm-cache')

    expect(result).toEqual({ success: true })
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/cron/prewarm-cache',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-secret',
        }),
      })
    )
  })
})
