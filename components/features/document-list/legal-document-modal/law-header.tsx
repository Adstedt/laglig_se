'use client'

/**
 * Story 6.3: Law Header
 * Title display with compliance status and priority badges
 * Aligned with Task Modal header design
 */

import { Badge } from '@/components/ui/badge'
import { Flag, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ComplianceStatus } from '@prisma/client'

interface LawHeaderProps {
  title: string
  aiCommentary: string | null
  complianceStatus: ComplianceStatus
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
}

// Compliance status configuration
const COMPLIANCE_CONFIG: Record<
  ComplianceStatus,
  { label: string; color: string; bgColor: string; icon?: React.ElementType }
> = {
  EJ_PABORJAD: {
    label: 'Ej påbörjad',
    color: '#6b7280',
    bgColor: 'bg-gray-100',
  },
  PAGAENDE: {
    label: 'Pågående',
    color: '#3b82f6',
    bgColor: 'bg-blue-50',
  },
  UPPFYLLD: {
    label: 'Uppfylld',
    color: '#22c55e',
    bgColor: 'bg-green-50',
    icon: CheckCircle2,
  },
  EJ_UPPFYLLD: {
    label: 'Ej uppfylld',
    color: '#ef4444',
    bgColor: 'bg-red-50',
    icon: XCircle,
  },
  EJ_TILLAMPLIG: {
    label: 'Ej tillämplig',
    color: '#9ca3af',
    bgColor: 'bg-gray-50',
  },
}

// Priority configuration
const PRIORITY_CONFIG = {
  LOW: {
    label: 'Låg',
    className: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
    iconClassName: 'text-gray-500',
  },
  MEDIUM: {
    label: 'Medium',
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    iconClassName: 'text-blue-500',
  },
  HIGH: {
    label: 'Hög',
    className: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
    iconClassName: 'text-orange-500',
  },
} as const

export function LawHeader({
  title,
  aiCommentary,
  complianceStatus,
  priority,
}: LawHeaderProps) {
  const complianceConfig = COMPLIANCE_CONFIG[complianceStatus]
  const priorityConfig = PRIORITY_CONFIG[priority]
  const ComplianceIcon = complianceConfig.icon

  return (
    <div className="space-y-3">
      {/* Title - aligned with Task Modal (text-xl) */}
      <h2 className="text-xl font-semibold leading-tight">{title}</h2>

      {/* Status and Priority Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Compliance Status Badge */}
        <Badge
          variant="outline"
          className="gap-1.5 font-medium"
          style={{
            backgroundColor: `${complianceConfig.color}15`,
            borderColor: `${complianceConfig.color}40`,
            color: complianceConfig.color,
          }}
        >
          {ComplianceIcon ? (
            <ComplianceIcon className="h-3 w-3" />
          ) : (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: complianceConfig.color }}
            />
          )}
          {complianceConfig.label}
        </Badge>

        {/* Priority Badge */}
        <Badge
          variant="secondary"
          className={cn('gap-1.5', priorityConfig.className)}
        >
          <Flag className={cn('h-3 w-3', priorityConfig.iconClassName)} />
          {priorityConfig.label}
        </Badge>
      </div>

      {/* AI Commentary if present */}
      {aiCommentary && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-medium">AI-sammanfattning: </span>
            {aiCommentary}
          </p>
        </div>
      )}
    </div>
  )
}
