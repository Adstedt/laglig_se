/**
 * Internal cache-invalidation endpoint (Story 2.6)
 *
 * revalidateTag() only works from a server context, so ingestion scripts
 * (e.g. scripts/ingest-eu-corpus.ts) cannot invalidate the 1h render caches
 * directly. They POST here after DB writes instead.
 *
 * Auth: Bearer CRON_SECRET (required — no open fallback).
 */
import { NextResponse } from 'next/server'
import {
  invalidateEuCaches,
  invalidateLawCaches,
  invalidateAllCaches,
} from '@/lib/cache/invalidation'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { scope?: string }
  const scope = body.scope ?? 'eu'

  try {
    const result =
      scope === 'all'
        ? await invalidateAllCaches()
        : scope === 'laws'
          ? await invalidateLawCaches()
          : await invalidateEuCaches()
    return NextResponse.json({ ok: true, scope, ...result })
  } catch (error) {
    console.error('[INVALIDATE-CACHE] Failed:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}
