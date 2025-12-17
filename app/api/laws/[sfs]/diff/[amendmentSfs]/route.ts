/**
 * GET /api/laws/[sfs]/diff/[amendmentSfs]
 *
 * Returns a diff showing what changed in a specific amendment
 * (compared to the version immediately before it)
 *
 * URL params:
 *   sfs - The base law SFS number (e.g., "1977:1160")
 *   amendmentSfs - The amendment SFS number (e.g., "2000:764")
 *
 * Response:
 *   200 - Diff between previous version and this amendment's version
 *   400 - Invalid parameters
 *   404 - Law or amendment not found
 */
import { NextResponse } from 'next/server'
import { getCachedLawDiff } from '@/lib/legal-document/version-cache'
import { getLawAmendmentTimeline } from '@/lib/legal-document/version-reconstruction'
import { getChangedSections } from '@/lib/legal-document/version-diff'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    sfs: string
    amendmentSfs: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { sfs: rawSfs, amendmentSfs: rawAmendmentSfs } = await params

    // Decode URI components
    const baseLawSfs = decodeURIComponent(rawSfs)
    const amendmentSfs = decodeURIComponent(rawAmendmentSfs)

    // Normalize SFS format (ensure "SFS " prefix)
    const normalizedBaseSfs = baseLawSfs.startsWith('SFS ')
      ? baseLawSfs
      : `SFS ${baseLawSfs}`
    const normalizedAmendmentSfs = amendmentSfs.startsWith('SFS ')
      ? amendmentSfs
      : `SFS ${amendmentSfs}`

    // Get the amendment timeline to find the dates
    const timeline = await getLawAmendmentTimeline(normalizedBaseSfs)

    if (timeline.length === 0) {
      return NextResponse.json(
        { error: 'Not found', message: `Law ${baseLawSfs} not found` },
        { status: 404 }
      )
    }

    // Find the amendment in the timeline
    const amendmentIndex = timeline.findIndex(
      (a) =>
        a.sfsNumber === normalizedAmendmentSfs || a.sfsNumber === amendmentSfs
    )

    if (amendmentIndex === -1) {
      return NextResponse.json(
        { error: 'Not found', message: `Amendment ${amendmentSfs} not found` },
        { status: 404 }
      )
    }

    const amendment = timeline[amendmentIndex]

    // Ensure amendment has a valid effective date
    if (!amendment || !amendment.effectiveDate) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: `Amendment ${amendmentSfs} has no effective date`,
        },
        { status: 404 }
      )
    }

    const effectiveDate = new Date(amendment.effectiveDate)

    // Find the previous version date
    // Timeline is sorted newest first, so previous version is at amendmentIndex + 1
    let previousDate: Date

    if (amendmentIndex === timeline.length - 1) {
      // This is the oldest amendment, compare to the original law
      // Use a date just before the first amendment
      previousDate = new Date(effectiveDate)
      previousDate.setDate(previousDate.getDate() - 1)
    } else {
      // Get the date of the previous amendment
      const prevAmendment = timeline[amendmentIndex + 1]
      if (!prevAmendment || !prevAmendment.effectiveDate) {
        // Fallback: use day before current amendment
        previousDate = new Date(effectiveDate)
        previousDate.setDate(previousDate.getDate() - 1)
      } else {
        previousDate = new Date(prevAmendment.effectiveDate)
      }
    }

    // Get the diff between previous version and this amendment's version
    const diff = await getCachedLawDiff(
      normalizedBaseSfs,
      previousDate,
      effectiveDate
    )

    if (!diff) {
      return NextResponse.json(
        { error: 'Not found', message: `Could not generate diff` },
        { status: 404 }
      )
    }

    // Only return changed sections
    const changedSections = getChangedSections(diff)

    // Transform lineDiff format for UI
    const transformLineDiff = (
      lineDiff?: Array<{ value: string; added?: boolean; removed?: boolean }>
    ) => {
      if (!lineDiff) return undefined
      return lineDiff.map((line) => ({
        type: line.added ? 'add' : line.removed ? 'remove' : 'context',
        content: line.value.replace(/\n$/, ''),
      }))
    }

    return NextResponse.json(
      {
        baseLawSfs: normalizedBaseSfs,
        amendmentSfs: amendment.sfsNumber,
        effectiveDate: effectiveDate.toISOString().split('T')[0],
        previousDate: previousDate.toISOString().split('T')[0],
        summary: diff.summary,
        sections: changedSections.map((s) => ({
          chapter: s.chapter,
          section: s.section,
          changeType: s.changeType,
          linesAdded: s.linesAdded,
          linesRemoved: s.linesRemoved,
          textA: s.textA,
          textB: s.textB,
          lineDiff: transformLineDiff(s.lineDiff),
          textUnavailable: s.textUnavailable,
          amendmentsBetween: s.amendmentsBetween?.map((a) => ({
            sfsNumber: a.sfsNumber,
            effectiveDate:
              a.effectiveDate instanceof Date
                ? a.effectiveDate.toISOString().split('T')[0]
                : a.effectiveDate,
            changeType: a.changeType,
            hasText: a.hasText,
          })),
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error generating amendment diff:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
