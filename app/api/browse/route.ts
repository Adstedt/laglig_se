/**
 * Browse API Route
 *
 * Thin wrapper around browseDocumentsAction for client-side SWR fetching.
 * Enables client-side caching while leveraging server-side Redis/unstable_cache.
 *
 * Benefits:
 * - Client SWR cache for instant filter changes
 * - Server-side Redis + unstable_cache for database query caching
 * - Private Cache-Control to allow browser caching without CDN issues
 */
import { NextResponse } from 'next/server'
import { browseDocumentsAction, type BrowseInput } from '@/app/actions/browse'

export async function POST(request: Request) {
  try {
    const input: BrowseInput = await request.json()
    const result = await browseDocumentsAction(input)

    return NextResponse.json(result, {
      headers: {
        // Private cache - browser can cache, but CDN won't
        // This complements SWR's client-side caching
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error) {
    console.error('[API/BROWSE] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Kunde inte hämta dokument',
        results: [],
        total: 0,
        page: 1,
        totalPages: 0,
        queryTimeMs: 0,
      },
      { status: 500 }
    )
  }
}
