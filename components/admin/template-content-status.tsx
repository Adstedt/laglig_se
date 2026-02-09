import { ContentStatusBadge } from '@/components/admin/content-status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TemplateItemContentStatus } from '@prisma/client'

const STATUS_ORDER: TemplateItemContentStatus[] = [
  'STUB',
  'AI_GENERATED',
  'HUMAN_REVIEWED',
  'APPROVED',
]

const STATUS_COLORS: Record<TemplateItemContentStatus, string> = {
  STUB: 'bg-gray-300',
  AI_GENERATED: 'bg-blue-500',
  HUMAN_REVIEWED: 'bg-yellow-400',
  APPROVED: 'bg-green-500',
}

interface TemplateContentStatusProps {
  counts: Record<TemplateItemContentStatus, number>
}

export function TemplateContentStatus({ counts }: TemplateContentStatusProps) {
  const total = STATUS_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0)

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Innehållsstatus</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Inga objekt ännu</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Innehållsstatus ({total} objekt)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {STATUS_ORDER.map((status) => {
            const count = counts[status] ?? 0
            if (count === 0) return null
            const percentage = (count / total) * 100
            return (
              <div
                key={status}
                className={`${STATUS_COLORS[status]} transition-all`}
                style={{ width: `${percentage}%` }}
              />
            )
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2">
          {STATUS_ORDER.map((status) => {
            const count = counts[status] ?? 0
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={status} className="flex items-center gap-2 text-sm">
                <ContentStatusBadge status={status} />
                <span className="text-muted-foreground">
                  {count} ({percentage}%)
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
