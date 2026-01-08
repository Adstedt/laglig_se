'use client'

/**
 * Story 4.12 & 6.2: Bulk Action Bar for Table View
 * Floating bar that appears when items are selected
 * Updated: Removed legacy status, added compliance status and responsible person
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { X, Loader2, User } from 'lucide-react'
import type { LawListItemPriority, ComplianceStatus } from '@prisma/client'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import { cn } from '@/lib/utils'

const PRIORITY_OPTIONS: { value: LawListItemPriority; label: string }[] = [
  { value: 'LOW', label: 'Låg' },
  { value: 'MEDIUM', label: 'Medel' },
  { value: 'HIGH', label: 'Hög' },
]

// Story 6.2: Compliance status options
const COMPLIANCE_STATUS_OPTIONS: { value: ComplianceStatus; label: string }[] =
  [
    { value: 'EJ_PABORJAD', label: 'Ej påbörjad' },
    { value: 'PAGAENDE', label: 'Pågående' },
    { value: 'UPPFYLLD', label: 'Uppfylld' },
    { value: 'EJ_UPPFYLLD', label: 'Ej uppfylld' },
    { value: 'EJ_TILLAMPLIG', label: 'Ej tillämplig' },
  ]

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

interface BulkActionBarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkUpdate: (_updates: {
    priority?: LawListItemPriority
    complianceStatus?: ComplianceStatus
    responsibleUserId?: string | null
  }) => Promise<void>
  // Story 6.2: Members for responsible person selector
  workspaceMembers?: WorkspaceMemberOption[]
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onBulkUpdate,
  workspaceMembers = [],
}: BulkActionBarProps) {
  const [isLoading, setIsLoading] = useState(false)
  // Story 6.2: Control dropdown open state - stay open after selection
  const [complianceOpen, setComplianceOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [responsibleOpen, setResponsibleOpen] = useState(false)

  const handlePriorityChange = async (priority: LawListItemPriority) => {
    setIsLoading(true)
    try {
      await onBulkUpdate({ priority })
    } finally {
      setIsLoading(false)
    }
    // Keep dropdown open after selection - don't close it
  }

  const handleComplianceStatusChange = async (
    complianceStatus: ComplianceStatus
  ) => {
    setIsLoading(true)
    try {
      await onBulkUpdate({ complianceStatus })
    } finally {
      setIsLoading(false)
    }
    // Keep dropdown open after selection - don't close it
  }

  // Story 6.2: Handle responsible person bulk update
  const handleResponsibleChange = async (value: string) => {
    const responsibleUserId = value === '__unassigned__' ? null : value
    setIsLoading(true)
    try {
      await onBulkUpdate({ responsibleUserId })
    } finally {
      setIsLoading(false)
    }
    // Keep dropdown open after selection - don't close it
  }

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg border bg-muted/50',
        'animate-in slide-in-from-top-2 duration-200'
      )}
      role="toolbar"
      aria-label="Massåtgärder"
    >
      {/* Selection count */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? 'vald' : 'valda'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-7 px-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Rensa markering</span>
        </Button>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Compliance status change - stays open after selection */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Efterlevnad:</span>
        <Select
          open={complianceOpen}
          onOpenChange={setComplianceOpen}
          onValueChange={handleComplianceStatusChange}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Välj..." />
          </SelectTrigger>
          <SelectContent>
            {COMPLIANCE_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Priority change - stays open after selection */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Prioritet:</span>
        <Select
          open={priorityOpen}
          onOpenChange={setPriorityOpen}
          onValueChange={handlePriorityChange}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue placeholder="Välj..." />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Story 6.2: Responsible person change - stays open after selection */}
      {workspaceMembers.length > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Ansvarig:</span>
            <Select
              open={responsibleOpen}
              onOpenChange={setResponsibleOpen}
              onValueChange={handleResponsibleChange}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue placeholder="Välj..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-muted-foreground">Ingen</span>
                  </div>
                </SelectItem>
                {workspaceMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={member.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(member.name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.name || member.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
