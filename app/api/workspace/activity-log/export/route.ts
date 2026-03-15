/**
 * Story 6.10: Activity Log CSV Export
 * API route that exports filtered activity log as CSV
 */

import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceContext,
  WorkspaceAccessError,
} from '@/lib/auth/workspace-context'
import {
  ACTION_LABELS,
  ENTITY_TYPE_LABELS,
} from '@/lib/constants/activity-labels'

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceContext()
    const { searchParams } = request.nextUrl

    // Build query filters
    const where: Record<string, unknown> = { workspace_id: workspaceId }

    const userId = searchParams.get('user')
    if (userId) where.user_id = userId

    const entityTypes = searchParams.getAll('entityType')
    if (entityTypes.length) where.entity_type = { in: entityTypes }

    const actions = searchParams.getAll('action')
    if (actions.length) where.action = { in: actions }

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

    // Build CSV
    const headers =
      'Tidpunkt,Användare,E-post,Åtgärd,Entitetstyp,Entitets-ID,Gammalt värde,Nytt värde'

    const rows = activities.map((a) => {
      const timestamp = format(new Date(a.created_at), 'yyyy-MM-dd HH:mm:ss', {
        locale: sv,
      })
      const userName = escapeCsvField(a.user.name ?? '')
      const email = escapeCsvField(a.user.email)
      const action = escapeCsvField(ACTION_LABELS[a.action] ?? a.action)
      const entityType = escapeCsvField(
        ENTITY_TYPE_LABELS[a.entity_type] ?? a.entity_type
      )
      const entityId = escapeCsvField(a.entity_id)
      const oldValue = escapeCsvField(
        a.old_value ? JSON.stringify(a.old_value) : ''
      )
      const newValue = escapeCsvField(
        a.new_value ? JSON.stringify(a.new_value) : ''
      )

      return `${timestamp},${userName},${email},${action},${entityType},${entityId},${oldValue},${newValue}`
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
