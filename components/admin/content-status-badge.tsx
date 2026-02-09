import { Badge } from '@/components/ui/badge'
import {
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_VARIANT,
} from '@/lib/admin/constants'
import type { TemplateItemContentStatus } from '@prisma/client'

export function ContentStatusBadge({
  status,
}: {
  status: TemplateItemContentStatus
}) {
  const variant = CONTENT_STATUS_VARIANT[status]
  const label = CONTENT_STATUS_LABELS[status]

  return (
    <Badge
      variant={variant}
      className={
        status === 'APPROVED' ? 'bg-green-100 text-green-800' : undefined
      }
    >
      {label}
    </Badge>
  )
}
