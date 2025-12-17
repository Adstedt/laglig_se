/**
 * GET /api/laws/[sfs]/version/[date]
 *
 * Returns the reconstructed version of a law at a specific date
 *
 * URL params:
 *   sfs - The SFS number (e.g., "1977:1160" or "SFS 1977:1160")
 *   date - The target date in YYYY-MM-DD format
 *
 * Response:
 *   200 - LawVersionResult JSON
 *   400 - Invalid parameters
 *   404 - Law not found
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCachedLawVersion } from '@/lib/legal-document/version-cache'
import {
  VersionRouteParamsSchema,
  formatZodError,
} from '@/app/api/laws/validation'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    sfs: string
    date: string
  }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const rawParams = await params

    // Validate params with Zod
    const parseResult = VersionRouteParamsSchema.safeParse(rawParams)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid parameters',
          message: formatZodError(parseResult.error),
        },
        { status: 400 }
      )
    }

    const { sfs: decodedSfs, date: targetDate } = parseResult.data

    // Get the law version (uses cache)
    const version = await getCachedLawVersion(decodedSfs, targetDate)

    if (!version) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: `Law ${decodedSfs} not found`,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(version, { status: 200 })
  } catch (error) {
    console.error('Error fetching law version:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
