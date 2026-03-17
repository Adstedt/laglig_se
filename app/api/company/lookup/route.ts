/**
 * Story 15.2: Company Lookup API Route
 * POST /api/company/lookup
 *
 * Accepts { orgNumber: string }, calls BolagsAPI, returns mapped company profile
 * plus raw address components for form field population.
 */

import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { getServerSession } from '@/lib/auth/session'
import {
  fetchCompany,
  mapBolagsApiToProfile,
  BolagsApiError,
} from '@/lib/bolagsapi'

const RequestSchema = z.object({
  orgNumber: z.string().regex(/^\d{6}-?\d{4}$/),
})

const ratelimit = isRedisConfigured()
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'ratelimit:company-lookup:user',
    })
  : null

export async function POST(req: Request) {
  try {
    // Authenticate
    const session = await getServerSession()
    if (!session?.user?.id) {
      return Response.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Rate limit
    if (ratelimit) {
      const { success } = await ratelimit.limit(session.user.id)
      if (!success) {
        return Response.json({ error: 'rate_limit_exceeded' }, { status: 429 })
      }
    }

    // Validate request body
    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'invalid_request' }, { status: 400 })
    }

    // Fetch company data
    const company = await fetchCompany(parsed.data.orgNumber)
    if (!company) {
      return Response.json({ error: 'company_not_found' }, { status: 404 })
    }

    // Map to profile
    const profile = mapBolagsApiToProfile(company)

    // Extract raw address components for individual form fields
    const address = {
      street: company.address?.street,
      postal_code: company.address?.postal_code,
      city: company.address?.city,
    }

    return Response.json({ profile, address })
  } catch (error) {
    if (error instanceof BolagsApiError) {
      return Response.json({ error: 'service_unavailable' }, { status: 503 })
    }

    console.error('[COMPANY LOOKUP ERROR]', error)
    return Response.json({ error: 'internal_error' }, { status: 500 })
  }
}
