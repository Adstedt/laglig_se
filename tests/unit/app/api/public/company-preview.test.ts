import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/bolagsapi', () => ({
  fetchWithTimeout: vi.fn(),
  mapBolagsApiToProfile: vi.fn(),
}))

vi.mock('@/lib/company-preview/company-analyzer', () => ({
  analyzeCompany: vi.fn(),
}))

vi.mock('@/lib/shared/regulatory-area-mapper', () => ({
  mapRegulatoryAreas: vi.fn(),
}))

vi.mock('@/lib/cache/redis', () => ({
  redis: {},
  isRedisConfigured: vi.fn(() => false),
  getCacheValue: vi.fn(() => null),
  setCacheValue: vi.fn(),
}))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn(),
}))

import { POST } from '@/app/api/public/company-preview/route'
import { fetchWithTimeout, mapBolagsApiToProfile } from '@/lib/bolagsapi'
import { analyzeCompany } from '@/lib/company-preview/company-analyzer'
import { mapRegulatoryAreas } from '@/lib/shared/regulatory-area-mapper'
import { getCacheValue } from '@/lib/cache/redis'

const mockFetchWithTimeout = vi.mocked(fetchWithTimeout)
const mockMapBolagsApiToProfile = vi.mocked(mapBolagsApiToProfile)
const mockAnalyzeCompany = vi.mocked(analyzeCompany)
const mockMapRegulatoryAreas = vi.mocked(mapRegulatoryAreas)
const mockGetCacheValue = vi.mocked(getCacheValue)

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/public/company-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/public/company-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('BOLAGSAPI_API_KEY', 'test-key')
    mockGetCacheValue.mockResolvedValue(null)
  })

  it('returns company data on success', async () => {
    mockFetchWithTimeout.mockResolvedValue(
      new Response(JSON.stringify({ name: 'Test AB', orgnr: '5564521234' }), {
        status: 200,
      })
    )
    mockMapBolagsApiToProfile.mockReturnValue({
      company_name: 'Test AB',
      org_number: '556452-1234',
      legal_form: 'AB',
      address: 'Storgatan 1, 111 22 Stockholm',
      municipality: 'Stockholm',
      sni_code: '62010',
      industry_label: 'Dataprogrammering',
    })
    mockAnalyzeCompany.mockResolvedValue({
      activityFlags: { personalData: true },
      companySummary: 'IT-konsultbolag',
      confidence: 'high',
    })
    mockMapRegulatoryAreas.mockReturnValue(['GDPR', 'Bokföring', 'Bolagsrätt'])

    const res = await POST(makeRequest({ orgNumber: '556452-1234' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.company.name).toBe('Test AB')
    expect(data.company.orgNumber).toBe('556452-1234')
    expect(data.areas).toEqual(['GDPR', 'Bokföring', 'Bolagsrätt'])
    expect(data.areaCount).toBe(3)
    expect(data.companySummary).toBe('IT-konsultbolag')
  })

  it('returns 404 when company not found', async () => {
    mockFetchWithTimeout.mockResolvedValue(new Response('', { status: 404 }))

    const res = await POST(makeRequest({ orgNumber: '000000-0000' }))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe('company_not_found')
  })

  it('returns 503 when BolagsAPI is down (500)', async () => {
    mockFetchWithTimeout.mockResolvedValue(new Response('', { status: 500 }))

    const res = await POST(makeRequest({ orgNumber: '556452-1234' }))
    const data = await res.json()

    expect(res.status).toBe(503)
    expect(data.error).toBe('service_unavailable')
  })

  it('returns 503 when BolagsAPI is rate limited (429)', async () => {
    mockFetchWithTimeout.mockResolvedValue(new Response('', { status: 429 }))

    const res = await POST(makeRequest({ orgNumber: '556452-1234' }))
    const data = await res.json()

    expect(res.status).toBe(503)
    expect(data.error).toBe('service_unavailable')
  })

  it('returns 503 on fetch timeout', async () => {
    mockFetchWithTimeout.mockRejectedValue(
      new DOMException('Aborted', 'AbortError')
    )

    const res = await POST(makeRequest({ orgNumber: '556452-1234' }))
    const data = await res.json()

    expect(res.status).toBe(503)
    expect(data.error).toBe('service_unavailable')
  })

  it('retries on transient timeout and succeeds on later attempt', async () => {
    mockFetchWithTimeout
      .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
      .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'Test AB', orgnr: '5564521234' }), {
          status: 200,
        })
      )
    mockMapBolagsApiToProfile.mockReturnValue({
      company_name: 'Test AB',
      org_number: '556452-1234',
      legal_form: 'AB',
    })
    mockAnalyzeCompany.mockResolvedValue({
      activityFlags: {},
      companySummary: null,
      confidence: 'low',
    })
    mockMapRegulatoryAreas.mockReturnValue(['Bolagsrätt'])

    const res = await POST(makeRequest({ orgNumber: '556452-1234' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.company.name).toBe('Test AB')
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(3)
  })

  it('returns 400 on invalid org number format', async () => {
    const res = await POST(makeRequest({ orgNumber: 'abc' }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('invalid_input')
  })

  it('returns 400 on missing org number', async () => {
    const res = await POST(makeRequest({}))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe('invalid_input')
  })

  it('returns cached response when available', async () => {
    const cachedData = {
      company: {
        name: 'Cached AB',
        orgNumber: '556452-1234',
        legalForm: 'AB',
        address: null,
        municipality: null,
        sniCode: null,
        industry: null,
      },
      areas: ['GDPR'],
      areaCount: 1,
      inferredFlags: {},
      companySummary: null,
    }
    mockGetCacheValue.mockResolvedValue(cachedData)

    const res = await POST(makeRequest({ orgNumber: '556452-1234' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.company.name).toBe('Cached AB')
    expect(mockFetchWithTimeout).not.toHaveBeenCalled()
  })

  it('returns 503 when API key is not configured', async () => {
    vi.stubEnv('BOLAGSAPI_API_KEY', '')

    const res = await POST(makeRequest({ orgNumber: '556452-1234' }))
    const data = await res.json()

    expect(res.status).toBe(503)
    expect(data.error).toBe('service_unavailable')
  })
})
