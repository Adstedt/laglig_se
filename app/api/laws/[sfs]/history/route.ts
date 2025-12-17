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
import {
  getLawAmendmentTimeline,
  getAvailableVersionDates,
} from '@/lib/legal-document/version-reconstruction'
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

    // Get amendment timeline and available dates
    const [timeline, availableDates] = await Promise.all([
      getLawAmendmentTimeline(decodedSfs),
      getAvailableVersionDates(decodedSfs),
    ])

    // If no amendments found, check if law exists
    if (timeline.length === 0) {
      // Could add a check here for law existence if needed
      // For now, return empty timeline
    }

    // Transform timeline to include public PDF URLs
    const amendmentsWithPdfUrls = timeline.map((a) => ({
      sfsNumber: a.sfsNumber,
      effectiveDate: a.effectiveDate,
      title: a.title,
      sectionCount: a.sectionCount,
      changeTypes: a.changeTypes,
      pdfUrl: a.storagePath ? getPublicPdfUrl(a.storagePath) : null,
    }))

    return NextResponse.json(
      {
        baseLawSfs: decodedSfs,
        totalAmendments: timeline.length,
        amendments: amendmentsWithPdfUrls,
        availableVersionDates: availableDates.map(
          (d) => d.toISOString().split('T')[0]
        ),
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
