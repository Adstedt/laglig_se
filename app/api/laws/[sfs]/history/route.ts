/**
 * GET /api/laws/[sfs]/history
 *
 * Returns the amendment timeline for a law
 *
 * URL params:
 *   sfs - The SFS number (e.g., "1977:1160" or "SFS 1977:1160")
 *
 * Response:
 *   200 - Array of amendments with section change counts
 *   400 - Invalid parameters
 *   404 - Law not found
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCachedAmendmentTimeline } from '@/lib/legal-document/version-cache'
import { getPublicPdfUrl } from '@/lib/supabase/storage'
import {
  HistoryRouteParamsSchema,
  formatZodError,
} from '@/app/api/laws/validation'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    sfs: string
  }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const rawParams = await params

    // Validate params with Zod
    const parseResult = HistoryRouteParamsSchema.safeParse(rawParams)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid parameters',
          message: formatZodError(parseResult.error),
        },
        { status: 400 }
      )
    }

    const { sfs: decodedSfs } = parseResult.data

    // Get amendment timeline (cached for 24h)
    const timeline = await getCachedAmendmentTimeline(decodedSfs)

    // Transform timeline to include public PDF URLs and slugs
    const amendmentsWithPdfUrls = timeline.map((a) => ({
      sfsNumber: a.sfsNumber,
      effectiveDate: a.effectiveDate,
      title: a.title,
      sectionCount: a.sectionCount,
      changeTypes: a.changeTypes,
      pdfUrl: a.storagePath ? getPublicPdfUrl(a.storagePath) : null,
      slug: a.slug, // Story 2.29: Include slug for linking to amendment detail page
    }))

    // Derive available version dates from timeline
    const availableVersionDates = timeline
      .filter((a) => a.effectiveDate)
      .map((a) => a.effectiveDate!.toISOString().slice(0, 10))

    return NextResponse.json(
      {
        baseLawSfs: decodedSfs,
        totalAmendments: timeline.length,
        amendments: amendmentsWithPdfUrls,
        availableVersionDates,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching law history:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
