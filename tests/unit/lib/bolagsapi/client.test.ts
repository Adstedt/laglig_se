import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  fetchCompany,
  validateOrgNumber,
  BolagsApiError,
} from '@/lib/bolagsapi/client'

function mockEnv(key: string | undefined) {
  vi.stubEnv('BOLAGSAPI_API_KEY', key as string)
}

const SAMPLE_RESPONSE = {
  name: 'Laglig AB',
  orgnr: '5591234567',
  org_form: { code: 'AB', description: 'Aktiebolag' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('fetchCompany', () => {
  it('returns null when API key is not set', async () => {
    mockEnv(undefined)
    const result = await fetchCompany('5591234567')
    expect(result).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches company data successfully', async () => {
    mockEnv('test-key')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_RESPONSE),
    })

    const result = await fetchCompany('559123-4567')

    expect(result).toEqual(SAMPLE_RESPONSE)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.bolagsapi.se/v1/company/5591234567',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    )
  })

  it('returns null on 404', async () => {
    mockEnv('test-key')
    mockFetch.mockResolvedValue({ ok: false, status: 404 })

    const result = await fetchCompany('0000000000')
    expect(result).toBeNull()
  })

  it('throws BolagsApiError on 401', async () => {
    mockEnv('bad-key')
    mockFetch.mockResolvedValue({ ok: false, status: 401 })

    await expect(fetchCompany('5591234567')).rejects.toThrow(BolagsApiError)
    await expect(fetchCompany('5591234567')).rejects.toThrow('auth error')
  })

  it('throws BolagsApiError on 403', async () => {
    mockEnv('bad-key')
    mockFetch.mockResolvedValue({ ok: false, status: 403 })

    await expect(fetchCompany('5591234567')).rejects.toThrow(BolagsApiError)
  })

  it('returns null on 429 (rate limit)', async () => {
    mockEnv('test-key')
    mockFetch.mockResolvedValue({ ok: false, status: 429 })

    const result = await fetchCompany('5591234567')
    expect(result).toBeNull()
  })

  it('returns null on 500 (server error)', async () => {
    mockEnv('test-key')
    mockFetch.mockResolvedValue({ ok: false, status: 500 })

    const result = await fetchCompany('5591234567')
    expect(result).toBeNull()
  })

  it('returns null on timeout (AbortError)', async () => {
    mockEnv('test-key')
    const abortError = new DOMException(
      'The operation was aborted',
      'AbortError'
    )
    mockFetch.mockRejectedValue(abortError)

    const result = await fetchCompany('5591234567')
    expect(result).toBeNull()
  })
})

describe('validateOrgNumber', () => {
  it('returns null when API key is not set', async () => {
    mockEnv(undefined)
    const result = await validateOrgNumber('5591234567')
    expect(result).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns validation result for valid org number', async () => {
    mockEnv('test-key')
    const validationResult = {
      valid: true,
      exists: true,
      formatted: '559123-4567',
    }
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(validationResult),
    })

    const result = await validateOrgNumber('5591234567')

    expect(result).toEqual(validationResult)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.bolagsapi.se/v1/validate/5591234567',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    )
  })

  it('returns validation result for invalid checksum', async () => {
    mockEnv('test-key')
    const validationResult = {
      valid: false,
      exists: false,
      formatted: '559123-4560',
    }
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(validationResult),
    })

    const result = await validateOrgNumber('5591234560')
    expect(result).toEqual(validationResult)
    expect(result?.valid).toBe(false)
  })

  it('throws BolagsApiError on 401', async () => {
    mockEnv('bad-key')
    mockFetch.mockResolvedValue({ ok: false, status: 401 })

    await expect(validateOrgNumber('5591234567')).rejects.toThrow(
      BolagsApiError
    )
  })
})
