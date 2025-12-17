/**
 * GET /api/laws/[sfs]/diff
 *
 * Returns a diff between two versions of a law
 *
 * URL params:
 *   sfs - The SFS number (e.g., "1977:1160")
 *
 * Query params:
 *   from - The older date in YYYY-MM-DD format
 *   to - The newer date in YYYY-MM-DD format
 *   changesOnly - If "true", only return changed sections (default: false)
 *
 * Response:
 *   200 - LawVersionDiff JSON
 *   400 - Missing or invalid parameters
 *   404 - Law not found
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCachedLawDiff } from '@/lib/legal-document/version-cache'
import { getChangedSections } from '@/lib/legal-document/version-diff'
import {
  DiffRouteParamsSchema,
  DiffQueryParamsSchema,
  formatZodError,
} from '@/app/api/laws/validation'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    sfs: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const rawParams = await params
    const { searchParams } = new URL(request.url)

    // Validate route params with Zod
    const paramsResult = DiffRouteParamsSchema.safeParse(rawParams)

    if (!paramsResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid parameters',
          message: formatZodError(paramsResult.error),
        },
        { status: 400 }
      )
    }

    // Validate query params with Zod
    const queryParams = {
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      changesOnly: searchParams.get('changesOnly') || 'false',
    }

    const queryResult = DiffQueryParamsSchema.safeParse(queryParams)

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          message: formatZodError(queryResult.error),
        },
        { status: 400 }
      )
    }

    const { sfs: decodedSfs } = paramsResult.data
    const { from: dateA, to: dateB, changesOnly } = queryResult.data

    // Get the diff (uses cache)
    const diff = await getCachedLawDiff(decodedSfs, dateA, dateB)

    if (!diff) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: `Law ${decodedSfs} not found`,
        },
        { status: 404 }
      )
    }

    // Optionally filter to only changed sections
    const sections = changesOnly ? getChangedSections(diff) : diff.sections

    // Transform lineDiff from {value, added, removed} to {type, content} format
    // that the UI component expects
    const transformLineDiff = (
      lineDiff?: Array<{ value: string; added?: boolean; removed?: boolean }>
    ) => {
      if (!lineDiff) return undefined
      return lineDiff.map((line) => ({
        type: line.added ? 'add' : line.removed ? 'remove' : 'context',
        content: line.value.replace(/\n$/, ''), // Remove trailing newline for display
      }))
    }

    return NextResponse.json(
      {
        baseLawSfs: diff.baseLawSfs,
        dateA: diff.dateA.toISOString().split('T')[0],
        dateB: diff.dateB.toISOString().split('T')[0],
        summary: diff.summary,
        amendmentsBetween: diff.amendmentsBetween.map((a) => ({
          sfsNumber: a.sfsNumber,
          effectiveDate: a.effectiveDate.toISOString().split('T')[0],
        })),
        sections: sections.map((s) => ({
          chapter: s.chapter,
          section: s.section,
          changeType: s.changeType,
          linesAdded: s.linesAdded,
          linesRemoved: s.linesRemoved,
          // Only include text/diff for changed sections to reduce payload
          ...(s.changeType !== 'unchanged' && {
            textA: s.textA,
            textB: s.textB,
            lineDiff: transformLineDiff(s.lineDiff),
          }),
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error generating diff:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
