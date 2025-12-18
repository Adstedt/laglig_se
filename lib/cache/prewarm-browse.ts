/**
 * Browse Cache Prewarming Module
 *
 * Warms L2 Redis cache and unstable_cache for common catalogue queries.
 * Called after deployment via API route or as part of cron jobs.
 *
 * This ensures the first visitor after deployment or sync jobs hits a warm cache,
 * reducing initial load time from 3-4s to <500ms.
 */
import { browseDocumentsAction, type BrowseInput } from '@/app/actions/browse'

// High-priority queries to prewarm (default views, page 1-2)
const PREWARM_QUERIES: BrowseInput[] = [
  // Default catalogue views (page 1) - highest priority
  { page: 1, limit: 25, sortBy: 'date_desc' }, // /rattskallor
  {
    page: 1,
    limit: 25,
    sortBy: 'date_desc',
    contentTypes: ['SFS_LAW'],
  }, // /lagar
  {
    page: 1,
    limit: 25,
    sortBy: 'date_desc',
    contentTypes: [
      'COURT_CASE_AD',
      'COURT_CASE_HD',
      'COURT_CASE_HFD',
      'COURT_CASE_HOVR',
      'COURT_CASE_MOD',
      'COURT_CASE_MIG',
    ],
  }, // /rattsfall
  {
    page: 1,
    limit: 25,
    sortBy: 'date_desc',
    contentTypes: ['EU_REGULATION', 'EU_DIRECTIVE'],
  }, // /eu

  // Page 2 (frequently accessed after page 1)
  { page: 2, limit: 25, sortBy: 'date_desc' },
  {
    page: 2,
    limit: 25,
    sortBy: 'date_desc',
    contentTypes: ['SFS_LAW'],
  },

  // Common filter combinations - active status
  {
    page: 1,
    limit: 25,
    sortBy: 'date_desc',
    status: ['ACTIVE'],
  },
  {
    page: 1,
    limit: 25,
    sortBy: 'date_desc',
    contentTypes: ['SFS_LAW'],
    status: ['ACTIVE'],
  },
]

export interface PrewarmResult {
  warmed: number
  failed: number
  durationMs: number
  details: Array<{
    query: string
    success: boolean
    durationMs: number
  }>
}

/**
 * Prewarm browse cache with common queries
 * Runs queries sequentially to avoid overwhelming the database
 */
export async function prewarmBrowseCache(): Promise<PrewarmResult> {
  const startTime = performance.now()
  let warmed = 0
  let failed = 0
  const details: PrewarmResult['details'] = []

  for (const query of PREWARM_QUERIES) {
    const queryStart = performance.now()
    const queryDesc = `page:${query.page} types:${query.contentTypes?.join(',') || 'all'} status:${query.status?.join(',') || 'all'}`

    try {
      const result = await browseDocumentsAction(query)
      const queryDuration = performance.now() - queryStart

      if (result.success) {
        warmed++
        details.push({
          query: queryDesc,
          success: true,
          durationMs: Math.round(queryDuration),
        })
        console.log(
          `[PREWARM] OK: ${queryDesc} (${Math.round(queryDuration)}ms, ${result.total} results)`
        )
      } else {
        failed++
        details.push({
          query: queryDesc,
          success: false,
          durationMs: Math.round(queryDuration),
        })
        console.error(`[PREWARM] FAIL: ${queryDesc} - ${result.error}`)
      }
    } catch (error) {
      failed++
      details.push({
        query: queryDesc,
        success: false,
        durationMs: Math.round(performance.now() - queryStart),
      })
      console.error(`[PREWARM] ERROR: ${queryDesc}`, error)
    }
  }

  return {
    warmed,
    failed,
    durationMs: Math.round(performance.now() - startTime),
    details,
  }
}
