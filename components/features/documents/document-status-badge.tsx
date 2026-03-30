import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { WorkspaceDocumentStatus } from '@prisma/client'

interface StatusConfig {
  label: string
  variant: 'default' | 'secondary' | 'outline'
  className?: string | undefined
}

export const STATUS_CONFIG: Record<WorkspaceDocumentStatus, StatusConfig> = {
  DRAFT: { label: 'Utkast', variant: 'secondary' },
  IN_REVIEW: { label: 'Under granskning', variant: 'default' },
  APPROVED: {
    label: 'Godkänd',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  SUPERSEDED: {
    label: 'Ersatt',
    variant: 'secondary',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  ARCHIVED: { label: 'Arkiverad', variant: 'outline', className: 'italic' },
}

interface DocumentStatusBadgeProps {
  status: WorkspaceDocumentStatus | string
  className?: string | undefined
}

export function DocumentStatusBadge({
  status,
  className,
}: DocumentStatusBadgeProps) {
  const config = STATUS_CONFIG[status as WorkspaceDocumentStatus] ?? {
    label: status,
    variant: 'secondary' as const,
  }

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}
