/**
 * Sync Status Dashboard API
 *
 * Provides monitoring information about the sync status:
 * - Document counts by type
 * - Recent change events
 * - Version counts
 * - Amendment statistics
 * - Pending AI summaries
 *
 * Story 2.11 - Task 15: Monitoring & Error Handling
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ChangeType } from '@prisma/client'

export const dynamic = 'force-dynamic'

// Basic auth check (should use proper auth in production)
const ADMIN_SECRET = process.env.ADMIN_SECRET

export async function GET(request: Request) {
  // Check authorization
  const authHeader = request.headers.get('authorization')
  if (ADMIN_SECRET && authHeader !== `Bearer ${ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get document counts by type
    const documentCounts = await prisma.legalDocument.groupBy({
      by: ['content_type'],
      _count: true,
    })

    // Get version counts
    const versionCount = await prisma.documentVersion.count()

    // Get amendment count
    const amendmentCount = await prisma.amendment.count()

    // Get change event counts by type
    const changeEventCounts = await prisma.changeEvent.groupBy({
      by: ['change_type'],
      _count: true,
    })

    // Get recent change events (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentChangeEvents = await prisma.changeEvent.findMany({
      where: {
        detected_at: { gte: sevenDaysAgo },
      },
      orderBy: { detected_at: 'desc' },
      take: 20,
      include: {
        document: {
          select: {
            document_number: true,
            title: true,
          },
        },
      },
    })

    // Get pending AI summaries count
    const pendingAiSummaries = await prisma.changeEvent.count({
      where: {
        ai_summary: null,
        change_type: { in: [ChangeType.AMENDMENT, ChangeType.REPEAL] },
      },
    })

    // Get documents updated in last 24 hours
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const recentlyUpdated = await prisma.legalDocument.count({
      where: {
        updated_at: { gte: oneDayAgo },
      },
    })

    // Get documents created in last 24 hours
    const recentlyCreated = await prisma.legalDocument.count({
      where: {
        created_at: { gte: oneDayAgo },
      },
    })

    // Cross-reference count
    const crossReferenceCount = await prisma.crossReference.count()

    // Format document counts
    const documentsByType: Record<string, number> = {}
    for (const item of documentCounts) {
      documentsByType[item.content_type] = item._count
    }

    // Format change event counts
    const changesByType: Record<string, number> = {}
    for (const item of changeEventCounts) {
      changesByType[item.change_type] = item._count
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      documents: {
        total: Object.values(documentsByType).reduce((a, b) => a + b, 0),
        byType: documentsByType,
        recentlyCreated,
        recentlyUpdated,
      },
      versions: {
        total: versionCount,
      },
      amendments: {
        total: amendmentCount,
      },
      changeEvents: {
        total: Object.values(changesByType).reduce((a, b) => a + b, 0),
        byType: changesByType,
        last7Days: recentChangeEvents.length,
        pendingAiSummaries,
      },
      crossReferences: {
        total: crossReferenceCount,
      },
      recentChanges: recentChangeEvents.map(event => ({
        id: event.id,
        type: event.change_type,
        documentNumber: event.document.document_number,
        documentTitle: event.document.title,
        amendmentSfs: event.amendment_sfs,
        detectedAt: event.detected_at,
        hasAiSummary: !!event.ai_summary,
      })),
    })
  } catch (error) {
    console.error('Sync status check failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
