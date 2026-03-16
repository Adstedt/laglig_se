import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCompanyLookup } from '@/lib/hooks/use-company-lookup'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('useCompanyLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test 6.2.4: Invalid org number — no fetch triggered
  it('does not fetch for incomplete org numbers', async () => {
    renderHook(() => useCompanyLookup('12345'))

    // Wait longer than debounce
    await new Promise((r) => setTimeout(r, 700))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // Test 6.2.1: Debounce — cancels on rapid input change
  it('cancels previous debounce on new input', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          profile: { company_name: 'Second AB' },
          address: {},
        }),
    })

    // Start with invalid number (no fetch triggered)
    const { rerender } = renderHook(
      ({ orgNumber }: { orgNumber: string }) => useCompanyLookup(orgNumber),
      { initialProps: { orgNumber: '55912' } }
    )

    // Set first valid number
    rerender({ orgNumber: '559123-4567' })
    // Immediately change before debounce fires
    rerender({ orgNumber: '559999-8888' })

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalled()
      },
      { timeout: 2000 }
    )

    // The last org number should have been fetched
    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
    const body = JSON.parse(lastCall![1].body as string)
    expect(body.orgNumber).toBe('559999-8888')
  })

  // Test 6.2.2: Auto-fill data on success
  it('populates data and sets isAutoFilled on success', async () => {
    const responseData = {
      profile: { company_name: 'Test AB', sni_code: '62010' },
      address: { street: 'Storgatan 1', city: 'Stockholm' },
    }

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    })

    const { result } = renderHook(() => useCompanyLookup('559123-4567'))

    await waitFor(
      () => {
        expect(result.current.isAutoFilled).toBe(true)
      },
      { timeout: 2000 }
    )

    expect(result.current.data).toEqual(responseData)
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  // Test 6.2.3: Reset on org number change
  it('resets states when org number changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          profile: { company_name: 'Test AB' },
          address: {},
        }),
    })

    const { result, rerender } = renderHook(
      ({ orgNumber }: { orgNumber: string }) => useCompanyLookup(orgNumber),
      { initialProps: { orgNumber: '559123-4567' } }
    )

    await waitFor(
      () => {
        expect(result.current.isAutoFilled).toBe(true)
      },
      { timeout: 2000 }
    )

    // Change org number — states should reset immediately
    rerender({ orgNumber: '559999' })

    expect(result.current.data).toBeNull()
    expect(result.current.isAutoFilled).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // Test: 404 sets not_found error
  it('sets error to not_found on 404', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'company_not_found' }),
    })

    const { result } = renderHook(() => useCompanyLookup('559123-4567'))

    await waitFor(
      () => {
        expect(result.current.error).toBe('not_found')
      },
      { timeout: 2000 }
    )

    expect(result.current.data).toBeNull()
    expect(result.current.isAutoFilled).toBe(false)
  })

  // Test: 503 logs warning silently (no visible error)
  it('does not set visible error on 503', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'service_unavailable' }),
    })

    const { result } = renderHook(() => useCompanyLookup('559123-4567'))

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false)
        expect(mockFetch).toHaveBeenCalled()
      },
      { timeout: 2000 }
    )

    expect(result.current.error).toBeNull()
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})
