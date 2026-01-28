'use client'

/**
 * Story 6.3: Details Box
 * Right panel details: document info, efterlevnad (compliance), priority, responsible person, dates
 *
 * Design: Minimal inline style with hover states for interactivity
 * Aligned with law list column dropdowns and TasksAccordion design patterns
 * Uses optimistic UI patterns for immediate feedback
 */

import { useState, useEffect } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, Flag, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  updateListItemComplianceStatus,
  updateListItemResponsible,
  updateListItemPriority,
} from '@/app/actions/legal-document-modal'
import type { ListItemDetails } from '@/app/actions/legal-document-modal'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import type { ComplianceStatus } from '@prisma/client'

interface DetailsBoxProps {
  listItem: ListItemDetails
  workspaceMembers: WorkspaceMemberOption[]
  onUpdate: () => Promise<void>
  /** Notify parent of optimistic status/priority changes for header badges */
  onOptimisticChange?:
    | ((_fields: {
        complianceStatus?: ComplianceStatus
        priority?: 'LOW' | 'MEDIUM' | 'HIGH'
      }) => void)
    | undefined
}

// Status configuration - aligned with law list column dropdowns
const STATUS_CONFIG: Record<
  ComplianceStatus,
  { label: string; className: string; strikethrough?: boolean }
> = {
  EJ_PABORJAD: {
    label: 'Ej påbörjad',
    className: 'bg-gray-100 text-gray-700',
  },
  PAGAENDE: {
    label: 'Pågående',
    className: 'bg-blue-100 text-blue-700',
  },
  UPPFYLLD: {
    label: 'Uppfylld',
    className: 'bg-green-100 text-green-700',
  },
  EJ_UPPFYLLD: {
    label: 'Ej uppfylld',
    className: 'bg-red-100 text-red-700',
  },
  EJ_TILLAMPLIG: {
    label: 'Ej tillämplig',
    className: 'bg-gray-100 text-gray-500',
    strikethrough: true,
  },
}

// Priority configuration (aligned with Task Modal)
const PRIORITY_CONFIG = {
  LOW: {
    label: 'Låg',
    className: 'bg-gray-100 text-gray-700',
    iconClassName: 'text-gray-500',
  },
  MEDIUM: {
    label: 'Medium',
    className: 'bg-blue-100 text-blue-700',
    iconClassName: 'text-blue-500',
  },
  HIGH: {
    label: 'Hög',
    className: 'bg-orange-100 text-orange-700',
    iconClassName: 'text-orange-500',
  },
} as const

type Priority = keyof typeof PRIORITY_CONFIG

export function DetailsBox({
  listItem,
  workspaceMembers,
  onUpdate,
  onOptimisticChange,
}: DetailsBoxProps) {
  // Local state for optimistic UI - persists user selection immediately
  const [localStatus, setLocalStatus] = useState(listItem.complianceStatus)
  const [localPriority, setLocalPriority] = useState(listItem.priority)
  const [isStatusLoading, setIsStatusLoading] = useState(false)
  const [isPriorityLoading, setIsPriorityLoading] = useState(false)

  // Sync local state when props change (e.g., after navigation or external update)
  useEffect(() => {
    setLocalStatus(listItem.complianceStatus)
  }, [listItem.complianceStatus])

  useEffect(() => {
    setLocalPriority(listItem.priority)
  }, [listItem.priority])

  const handleStatusChange = async (status: ComplianceStatus) => {
    if (status === localStatus) return
    setLocalStatus(status) // Optimistic update
    onOptimisticChange?.({ complianceStatus: status }) // Update header badges
    setIsStatusLoading(true)
    try {
      await updateListItemComplianceStatus(listItem.id, status)
    } finally {
      setIsStatusLoading(false)
    }
  }

  const handlePriorityChange = async (priority: Priority) => {
    if (priority === localPriority) return
    setLocalPriority(priority) // Optimistic update
    onOptimisticChange?.({ priority }) // Update header badges
    setIsPriorityLoading(true)
    try {
      await updateListItemPriority(listItem.id, priority)
    } finally {
      setIsPriorityLoading(false)
    }
  }

  const handleResponsibleChange = async (userId: string) => {
    const actualUserId = userId === 'unassigned' ? null : userId
    await updateListItemResponsible(listItem.id, actualUserId)
    await onUpdate()
  }

  // Use local state values for display (optimistic)
  const statusConfig = STATUS_CONFIG[localStatus]
  const priorityConfig = PRIORITY_CONFIG[localPriority]

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-foreground">
          Detaljer
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1">
        <div className="space-y-0">
          {/* Document Number - Read only */}
          <DetailRow label="Dokumentnummer">
            <span className="text-sm font-mono text-foreground">
              {listItem.legalDocument.documentNumber}
            </span>
          </DetailRow>

          {/* Efterlevnad (Compliance Status) - Editable with optimistic UI */}
          <DetailRow label="Efterlevnad" interactive>
            <Select
              value={localStatus}
              onValueChange={(v) => handleStatusChange(v as ComplianceStatus)}
              disabled={isStatusLoading}
            >
              <SelectTrigger
                className={cn(
                  '!h-auto !p-0 !border-0 !shadow-none !bg-transparent hover:!bg-transparent focus:!ring-0 !w-auto gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70',
                  isStatusLoading && 'opacity-50'
                )}
              >
                {isStatusLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SelectValue>
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        statusConfig.className,
                        statusConfig.strikethrough && 'line-through'
                      )}
                    >
                      {statusConfig.label}
                    </span>
                  </SelectValue>
                )}
              </SelectTrigger>
              <SelectContent align="end">
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        config.className,
                        config.strikethrough && 'line-through'
                      )}
                    >
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailRow>

          {/* Priority - Editable with optimistic UI */}
          <DetailRow label="Prioritet" interactive>
            <Select
              value={localPriority}
              onValueChange={(v) => handlePriorityChange(v as Priority)}
              disabled={isPriorityLoading}
            >
              <SelectTrigger
                className={cn(
                  '!h-auto !p-0 !border-0 !shadow-none !bg-transparent hover:!bg-transparent focus:!ring-0 !w-auto gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70',
                  isPriorityLoading && 'opacity-50'
                )}
              >
                {isPriorityLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SelectValue>
                    <div className="flex items-center gap-1.5">
                      <Flag
                        className={cn(
                          'h-3.5 w-3.5',
                          priorityConfig.iconClassName
                        )}
                      />
                      <span className="text-sm text-foreground">
                        {priorityConfig.label}
                      </span>
                    </div>
                  </SelectValue>
                )}
              </SelectTrigger>
              <SelectContent align="end">
                {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      <Flag className={cn('h-4 w-4', config.iconClassName)} />
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailRow>

          {/* Responsible - Editable */}
          <DetailRow label="Ansvarig" interactive>
            <Select
              value={listItem.responsibleUser?.id ?? 'unassigned'}
              onValueChange={handleResponsibleChange}
            >
              <SelectTrigger className="!h-auto !p-0 !border-0 !shadow-none !bg-transparent hover:!bg-transparent focus:!ring-0 !w-auto gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70">
                <SelectValue>
                  {listItem.responsibleUser ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5 border border-border/30">
                        {listItem.responsibleUser.avatarUrl && (
                          <AvatarImage
                            src={listItem.responsibleUser.avatarUrl}
                          />
                        )}
                        <AvatarFallback className="text-[9px] bg-muted">
                          {(
                            listItem.responsibleUser.name ??
                            listItem.responsibleUser.email
                          )
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-foreground">
                        {listItem.responsibleUser.name ??
                          listItem.responsibleUser.email}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="text-sm">Ingen tilldelad</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="unassigned">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Ingen tilldelad</span>
                  </div>
                </SelectItem>
                {workspaceMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        {member.avatarUrl && (
                          <AvatarImage src={member.avatarUrl} />
                        )}
                        <AvatarFallback className="text-[9px]">
                          {(member.name ?? member.email)
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.name ?? member.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailRow>

          {/* Due date (if set) - Read only for now */}
          {listItem.dueDate && (
            <DetailRow label="Deadline">
              <span className="text-sm text-foreground">
                {format(new Date(listItem.dueDate), 'd MMM yyyy', {
                  locale: sv,
                })}
              </span>
            </DetailRow>
          )}

          {/* Created date - Read only */}
          <DetailRow label="Skapad">
            <span className="text-sm text-foreground">
              {format(new Date(listItem.addedAt), 'd MMM yyyy', { locale: sv })}
            </span>
          </DetailRow>

          {/* Last updated - Read only */}
          <DetailRow label="Senast uppdaterad">
            <span
              className="text-sm text-foreground"
              title={format(new Date(listItem.updatedAt), 'PPpp', {
                locale: sv,
              })}
            >
              {formatDistanceToNow(new Date(listItem.updatedAt), {
                addSuffix: true,
                locale: sv,
              })}
            </span>
          </DetailRow>
        </div>
      </CardContent>
    </Card>
  )
}

// Shared DetailRow component for consistent styling
interface DetailRowProps {
  label: string
  children: React.ReactNode
  interactive?: boolean
}

function DetailRow({ label, children, interactive = false }: DetailRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5 -mx-2 px-2 rounded-md transition-colors',
        interactive && 'hover:bg-muted/40 cursor-pointer'
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  )
}
