/**
 * GET /api/laws/[sfs]/sections/[chapter]/[section]/history
 *
 * Returns the change history for a specific section
 *
 * URL params:
 *   sfs - The SFS number (e.g., "1977:1160")
 *   chapter - The chapter number (e.g., "1") or "_" for laws without chapters
 *   section - The section number (e.g., "1" or "2a")
 *
 * Response:
 *   200 - Array of history entries for this section
 *   404 - Section not found
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSectionHistory } from '@/lib/legal-document/version-reconstruction'
import { formatSectionRef } from '@/lib/legal-document/version-diff'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    sfs: string
    chapter: string
    section: string
  }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { sfs, chapter, section } = await params

    // Decode URL parameters
    const decodedSfs = decodeURIComponent(sfs)
    const decodedChapter = decodeURIComponent(chapter)
    const decodedSection = decodeURIComponent(section)

    // Handle "_" as null chapter (for laws without chapters)
    const chapterValue = decodedChapter === '_' ? null : decodedChapter

    // Get section history
    const history = await getSectionHistory(
      decodedSfs,
      chapterValue,
      decodedSection
    )

    if (history.length === 0) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: `Section ${formatSectionRef(chapterValue, decodedSection)} not found in ${decodedSfs}`,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        baseLawSfs: decodedSfs,
        chapter: chapterValue,
        section: decodedSection,
        sectionRef: formatSectionRef(chapterValue, decodedSection),
        totalVersions: history.length,
        history: history.map((entry) => ({
          effectiveDate:
            entry.effectiveDate?.toISOString().split('T')[0] || null,
          amendmentSfs: entry.amendmentSfs,
          changeType: entry.changeType,
          isCurrent: entry.isCurrent,
          textPreview: entry.textContent?.substring(0, 200) || null,
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching section history:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
