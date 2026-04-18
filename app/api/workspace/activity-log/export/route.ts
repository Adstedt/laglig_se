/**
 * Story 6.10 + activity-log revamp: Activity Log CSV Export
 * Exports filtered activity log as CSV. Now includes the rendered Swedish
 * sentence and category, plus resolved entity names (tombstones preserved
 * for deleted entities). Old/new-value JSON stays for audit immutability.
 */

import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import { ENTITY_TYPE_LABELS } from '@/lib/constants/activity-labels'
import { resolveEntityNames } from '@/lib/activity/entity-resolver'
import {
  categoryForAction,
  CATEGORY_META,
  actionsForCategory,
} from '@/lib/activity/categories'
import {
  formatActivity,
  sentencePartsToText,
} from '@/lib/activity/format-activity'
import { ACTIVITY_CATEGORIES } from '@/lib/activity/categories'
import type { ActivityCategory } from '@/lib/activity/types'

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function isCategory(v: string): v is ActivityCategory {
  return (ACTIVITY_CATEGORIES as string[]).includes(v)
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceContext()
    const { searchParams } = request.nextUrl

    const where: Record<string, unknown> = { workspace_id: workspaceId }

    const userId = searchParams.get('user')
    if (userId) where.user_id = userId

    const entityTypes = searchParams.getAll('entityType')
    if (entityTypes.length) where.entity_type = { in: entityTypes }

    const explicitActions = searchParams.getAll('action')
    const categoryParams = searchParams.getAll('category').filter(isCategory)
    if (explicitActions.length > 0) {
      where.action = { in: explicitActions }
    } else if (categoryParams.length > 0) {
      where.action = {
        in: categoryParams.flatMap((c) => actionsForCategory(c)),
      }
    }

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {}
      if (startDate) createdAt.gte = new Date(startDate)
      if (endDate) createdAt.lte = new Date(endDate)
      where.created_at = createdAt
    }

    const activities = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    })

    // Resolve entity names in one pass (dedup + parallel findMany per model).
    const resolved = await resolveEntityNames(activities, workspaceId)

    const headers = [
      'Tidpunkt',
      'Användare',
      'E-post',
      'Kategori',
      'Mening',
      'Åtgärd',
      'Entitetstyp',
      'Entitets-ID',
      'Länkad entitet',
      'Gammalt värde',
      'Nytt värde',
    ].join(',')

    const rows = activities.map((a) => {
      const refs = resolved.get(a.id)
      const primary = refs?.primary ?? {
        id: a.entity_id,
        label: `[${a.entity_type}]`,
        href: null,
        deleted: false,
      }
      const category = categoryForAction(a.action)
      const parts = formatActivity({
        action: a.action,
        entity_type: a.entity_type,
        user: { name: a.user.name, email: a.user.email },
        old_value: a.old_value,
        new_value: a.new_value,
        primary,
        ...(refs?.secondary ? { secondary: refs.secondary } : {}),
      })
      const sentence = sentencePartsToText(parts)

      const timestamp = format(new Date(a.created_at), 'yyyy-MM-dd HH:mm:ss', {
        locale: sv,
      })
      const userName = escapeCsvField(a.user.name ?? '')
      const email = escapeCsvField(a.user.email)
      const categoryLabel = escapeCsvField(CATEGORY_META[category].label)
      const meningCell = escapeCsvField(sentence)
      const action = escapeCsvField(a.action)
      const entityType = escapeCsvField(
        ENTITY_TYPE_LABELS[a.entity_type] ?? a.entity_type
      )
      const entityId = escapeCsvField(a.entity_id)
      const secondaryLabel = escapeCsvField(refs?.secondary?.label ?? '')
      const oldValue = escapeCsvField(
        a.old_value ? JSON.stringify(a.old_value) : ''
      )
      const newValue = escapeCsvField(
        a.new_value ? JSON.stringify(a.new_value) : ''
      )

      return [
        timestamp,
        userName,
        email,
        categoryLabel,
        meningCell,
        action,
        entityType,
        entityId,
        secondaryLabel,
        oldValue,
        newValue,
      ].join(',')
    })

    const csv = [headers, ...rows].join('\n')
    const filename = `aktivitetslogg-${format(new Date(), 'yyyy-MM-dd')}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      const statusCode = error.code === 'UNAUTHORIZED' ? 401 : 403
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCode }
      )
    }

    console.error('Activity log export error:', error)
    return NextResponse.json(
      { error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    )
  }
}
