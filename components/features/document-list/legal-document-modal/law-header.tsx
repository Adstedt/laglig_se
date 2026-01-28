'use client'

/**
 * Story 6.3: Law Header
 * Title display with compliance status and priority badges
 * Aligned with Task Modal header design
 */

import { Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ComplianceStatus } from '@prisma/client'

interface LawHeaderProps {
  title: string
  aiCommentary: string | null
  complianceStatus: ComplianceStatus
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
}

// Compliance status - aligned with law list column dropdowns
const COMPLIANCE_CONFIG: Record<
  ComplianceStatus,
  {
    label: string
    className: string
    dotColor: string
    strikethrough?: boolean
  }
> = {
  EJ_PABORJAD: {
    label: 'Ej påbörjad',
    className: 'bg-gray-100 text-gray-700',
    dotColor: 'bg-gray-700',
  },
  PAGAENDE: {
    label: 'Pågående',
    className: 'bg-blue-100 text-blue-700',
    dotColor: 'bg-blue-700',
  },
  UPPFYLLD: {
    label: 'Uppfylld',
    className: 'bg-green-100 text-green-700',
    dotColor: 'bg-green-700',
  },
  EJ_UPPFYLLD: {
    label: 'Ej uppfylld',
    className: 'bg-red-100 text-red-700',
    dotColor: 'bg-red-700',
  },
  EJ_TILLAMPLIG: {
    label: 'Ej tillämplig',
    className: 'bg-gray-100 text-gray-500',
    dotColor: 'bg-gray-500',
    strikethrough: true,
  },
}

// Priority configuration - aligned with list table and details-box
const PRIORITY_CONFIG = {
  LOW: {
    label: 'Låg',
    className: 'bg-slate-100 text-slate-700',
    iconClassName: 'text-slate-500',
  },
  MEDIUM: {
    label: 'Medel',
    className: 'bg-amber-100 text-amber-700',
    iconClassName: 'text-amber-500',
  },
  HIGH: {
    label: 'Hög',
    className: 'bg-rose-100 text-rose-700',
    iconClassName: 'text-rose-500',
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

  return (
    <div className="space-y-3">
      {/* Title - aligned with Task Modal (text-xl) */}
      <h2 className="text-xl font-semibold leading-tight">{title}</h2>

      {/* Status and Priority Badges - rounded-full pills matching law list columns */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Compliance Status Pill */}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
            complianceConfig.className,
            complianceConfig.strikethrough && 'line-through'
          )}
        >
          <span
            className={cn('w-2 h-2 rounded-full', complianceConfig.dotColor)}
          />
          {complianceConfig.label}
        </span>

        {/* Priority Pill */}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
            priorityConfig.className
          )}
        >
          <Flag className={cn('h-3 w-3', priorityConfig.iconClassName)} />
          {priorityConfig.label}
        </span>
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
