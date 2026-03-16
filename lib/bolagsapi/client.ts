/**
 * BolagsAPI Client
 *
 * Server-side client for fetching company data from BolagsAPI (Bolagsverket/SCB).
 * Uses free tier: GET /v1/company/{orgnr} and GET /v1/validate/{orgnr}.
 */

import type { BolagsApiCompany, BolagsApiValidationResult } from './types'

const BOLAGSAPI_BASE_URL = 'https://api.bolagsapi.se'
const TIMEOUT_MS = 5000

export class BolagsApiError extends Error {
  public statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'BolagsApiError'
    this.statusCode = statusCode
  }
}

function getApiKey(): string | undefined {
  return process.env.BOLAGSAPI_API_KEY
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch company data from BolagsAPI.
 *
 * Returns null if:
 * - API key is not configured
 * - Company not found (404)
 * - Rate limited (429)
 * - Server error (5xx)
 * - Request timeout
 *
 * Throws BolagsApiError on auth errors (401/403).
 */
export async function fetchCompany(
  orgNumber: string
): Promise<BolagsApiCompany | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return null
  }

  const digits = orgNumber.replace(/\D/g, '')
  const url = `${BOLAGSAPI_BASE_URL}/v1/company/${digits}`

  let response: Response
  try {
    response = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
      TIMEOUT_MS
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null
    }
    throw error
  }

  if (response.status === 404) {
    return null
  }

  if (response.status === 401 || response.status === 403) {
    throw new BolagsApiError(
      `BolagsAPI auth error: ${response.status}`,
      response.status
    )
  }

  if (response.status === 429 || response.status >= 500) {
    return null
  }

  if (!response.ok) {
    return null
  }

  return (await response.json()) as BolagsApiCompany
}

/**
 * Validate an organization number via BolagsAPI.
 *
 * Returns null if API key is not configured, on timeout, or on server errors.
 * Throws BolagsApiError on auth errors (401/403).
 */
export async function validateOrgNumber(
  orgNumber: string
): Promise<BolagsApiValidationResult | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return null
  }

  const digits = orgNumber.replace(/\D/g, '')
  const url = `${BOLAGSAPI_BASE_URL}/v1/validate/${digits}`

  let response: Response
  try {
    response = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
      TIMEOUT_MS
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null
    }
    throw error
  }

  if (response.status === 401 || response.status === 403) {
    throw new BolagsApiError(
      `BolagsAPI auth error: ${response.status}`,
      response.status
    )
  }

  if (response.status === 429 || response.status >= 500) {
    return null
  }

  if (!response.ok) {
    return null
  }

  return (await response.json()) as BolagsApiValidationResult
}
