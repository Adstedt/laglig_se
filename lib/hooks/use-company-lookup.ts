'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useDebounce } from './use-debounce'

const ORG_NUMBER_REGEX = /^\d{6}-?\d{4}$/

interface CompanyAddress {
  street?: string
  postal_code?: string
  city?: string
}

interface CompanyLookupData {
  profile: Record<string, unknown>
  address: CompanyAddress
}

type LookupError = 'not_found' | 'service_unavailable' | null

interface UseCompanyLookupResult {
  data: CompanyLookupData | null
  isLoading: boolean
  error: LookupError
  isAutoFilled: boolean
}

export function useCompanyLookup(orgNumber: string): UseCompanyLookupResult {
  const [data, setData] = useState<CompanyLookupData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<LookupError>(null)
  const [isAutoFilled, setIsAutoFilled] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const debouncedOrgNumber = useDebounce(orgNumber, 500)

  // Reset states and abort in-flight request when org number changes (AC 13)
  useEffect(() => {
    abortControllerRef.current?.abort()
    setData(null)
    setError(null)
    setIsAutoFilled(false)
  }, [orgNumber])

  const fetchLookup = useCallback(async (orgNr: string) => {
    // Abort any previous in-flight request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/company/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgNumber: orgNr }),
        signal: controller.signal,
      })

      if (response.status === 404) {
        setError('not_found')
        setData(null)
        setIsAutoFilled(false)
        return
      }

      if (response.status === 503) {
        // AC 10: no visible error on service unavailable
        console.warn('[Company Lookup] Service unavailable')
        setData(null)
        setIsAutoFilled(false)
        return
      }

      if (!response.ok) {
        // Other errors — no visible error to user
        console.warn('[Company Lookup] Unexpected status:', response.status)
        setData(null)
        setIsAutoFilled(false)
        return
      }

      const result = (await response.json()) as CompanyLookupData
      setData(result)
      setIsAutoFilled(true)
      setError(null)
    } catch (err) {
      // Ignore aborted requests
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Network errors — silent failure (AC 10)
      console.warn('[Company Lookup] Network error:', err)
      setData(null)
      setIsAutoFilled(false)
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [])

  // Trigger fetch when debounced value is a valid org number
  useEffect(() => {
    if (ORG_NUMBER_REGEX.test(debouncedOrgNumber)) {
      fetchLookup(debouncedOrgNumber)
    }
  }, [debouncedOrgNumber, fetchLookup])

  return { data, isLoading, error, isAutoFilled }
}
