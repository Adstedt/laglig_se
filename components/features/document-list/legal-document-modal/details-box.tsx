'use client'

/**
 * Story 6.3: Details Box
 * Right panel details: document info, status, responsible person, dates
 *
 * Design: Minimal inline style with hover states for interactivity
 * Aligned with TasksAccordion design patterns
 */

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
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  updateListItemComplianceStatus,
  updateListItemResponsible,
} from '@/app/actions/legal-document-modal'
import type { ListItemDetails } from '@/app/actions/legal-document-modal'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import type { ComplianceStatus } from '@prisma/client'

interface DetailsBoxProps {
  listItem: ListItemDetails
  workspaceMembers: WorkspaceMemberOption[]
  onUpdate: () => Promise<void>
}

// Status configuration
const STATUS_CONFIG: Record<
  ComplianceStatus,
  { label: string; color: string; bgColor: string }
> = {
  EJ_PABORJAD: {
    label: 'Ej påbörjad',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  PAGAENDE: {
    label: 'Pågående',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  UPPFYLLD: {
    label: 'Uppfylld',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  EJ_UPPFYLLD: {
    label: 'Ej uppfylld',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
  EJ_TILLAMPLIG: {
    label: 'Ej tillämplig',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
  },
}

export function DetailsBox({
  listItem,
  workspaceMembers,
  onUpdate,
}: DetailsBoxProps) {
  const handleStatusChange = async (status: ComplianceStatus) => {
    await updateListItemComplianceStatus(listItem.id, status)
    await onUpdate()
  }

  const handleResponsibleChange = async (userId: string) => {
    const actualUserId = userId === 'unassigned' ? null : userId
    await updateListItemResponsible(listItem.id, actualUserId)
    await onUpdate()
  }

  const statusConfig = STATUS_CONFIG[listItem.complianceStatus]

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

          {/* Status - Editable */}
          <DetailRow label="Status" interactive>
            <Select
              value={listItem.complianceStatus}
              onValueChange={(v) => handleStatusChange(v as ComplianceStatus)}
            >
              <SelectTrigger className="!h-auto !p-0 !border-0 !shadow-none !bg-transparent hover:!bg-transparent focus:!ring-0 !w-auto gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-70">
                <SelectValue>
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                      statusConfig.bgColor,
                      statusConfig.color
                    )}
                  >
                    {statusConfig.label}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                        config.bgColor,
                        config.color
                      )}
                    >
                      {config.label}
                    </span>
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
