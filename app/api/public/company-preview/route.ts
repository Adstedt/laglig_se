import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { getCacheValue, setCacheValue } from '@/lib/cache/redis'
import { fetchWithTimeout } from '@/lib/bolagsapi'
import { mapBolagsApiToProfile } from '@/lib/bolagsapi'
import type { BolagsApiCompany } from '@/lib/bolagsapi'
import { analyzeCompany } from '@/lib/company-preview/company-analyzer'
import { mapRegulatoryAreas } from '@/lib/shared/regulatory-area-mapper'
import { createHash } from 'crypto'

export const maxDuration = 30

const RequestSchema = z.object({
  orgNumber: z.string().regex(/^\d{6}-?\d{4}$/),
  websiteUrl: z.string().url().optional(),
})

const BOLAGSAPI_BASE_URL = 'https://api.bolagsapi.se'
const BOLAGSAPI_TIMEOUT_MS = 5000
const CACHE_TTL_SECONDS = 30 * 60 // 30 minutes

const ipRatelimit = isRedisConfigured()
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'ratelimit:preview:ip',
    })
  : null

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

function getCacheKey(orgNumber: string, websiteUrl?: string): string {
  const digits = orgNumber.replace(/\D/g, '')
  if (!websiteUrl) {
    return `preview:${digits}`
  }
  const urlHash = createHash('sha256')
    .update(websiteUrl)
    .digest('hex')
    .slice(0, 8)
  return `preview:${digits}:${urlHash}`
}

interface PreviewResponse {
  company: {
    name: string
    orgNumber: string
    legalForm: string | null
    address: string | null
    municipality: string | null
    sniCode: string | null
    industry: string | null
  }
  areas: string[]
  areaCount: number
  inferredFlags: Record<string, boolean>
  companySummary: string | null
}

export async function POST(request: NextRequest) {
  // Rate limit by IP
  if (ipRatelimit) {
    const ip = getClientIp(request)
    const { success } = await ipRatelimit.limit(ip)
    if (!success) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }
  }

  // Validate request body
  let body: z.infer<typeof RequestSchema>
  try {
    const raw = await request.json()
    body = RequestSchema.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const { orgNumber, websiteUrl } = body
  const cacheKey = getCacheKey(orgNumber, websiteUrl)

  // Check cache first
  const cached = await getCacheValue<PreviewResponse>(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  // Fetch from BolagsAPI directly (not fetchCompany — need distinct status codes)
  const apiKey = process.env.BOLAGSAPI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
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
      BOLAGSAPI_TIMEOUT_MS
    )
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  if (response.status === 404 || response.status === 400) {
    return NextResponse.json({ error: 'company_not_found' }, { status: 404 })
  }

  if (response.status === 429 || response.status >= 500) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  if (!response.ok) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  const apiData = (await response.json()) as BolagsApiCompany
  const profile = mapBolagsApiToProfile(apiData)

  // LLM analysis (silent failure)
  const analysis = await analyzeCompany({
    name: profile.company_name ?? apiData.name,
    sniCode: profile.sni_code as string | undefined,
    sniDescription: profile.industry_label as string | undefined,
    businessDescription: profile.business_description as string | undefined,
    websiteUrl,
  })

  // Map regulatory areas
  const taxStatus: Partial<Record<string, boolean>> = {}
  if (apiData.tax_status) {
    if (apiData.tax_status.f_tax !== undefined)
      taxStatus.f_tax = apiData.tax_status.f_tax
    if (apiData.tax_status.vat !== undefined)
      taxStatus.vat = apiData.tax_status.vat
    if (apiData.tax_status.employer !== undefined)
      taxStatus.employer = apiData.tax_status.employer
  }
  const areas = mapRegulatoryAreas({
    legalForm: (profile.legal_form as string) ?? '',
    taxStatus,
    activityFlags: analysis.activityFlags,
  })

  const previewResponse: PreviewResponse = {
    company: {
      name: profile.company_name ?? apiData.name,
      orgNumber: profile.org_number ?? orgNumber,
      legalForm: (profile.legal_form as string) ?? null,
      address: (profile.address as string) ?? null,
      municipality: (profile.municipality as string) ?? null,
      sniCode: (profile.sni_code as string) ?? null,
      industry: (profile.industry_label as string) ?? null,
    },
    areas,
    areaCount: areas.length,
    inferredFlags: analysis.activityFlags,
    companySummary: analysis.companySummary,
  }

  // Cache successful response
  await setCacheValue(cacheKey, previewResponse, CACHE_TTL_SECONDS)

  return NextResponse.json(previewResponse)
}
