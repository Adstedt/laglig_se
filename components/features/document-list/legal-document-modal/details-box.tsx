'use client'

/**
 * Story 6.3: Details Box
 * Right panel details: document info, status, responsible person, dates
 */

import { format, formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ComplianceStatusEditor } from '../table-cell-editors/compliance-status-editor'
import { ResponsibleEditor } from '../table-cell-editors/responsible-editor'
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

export function DetailsBox({
  listItem,
  workspaceMembers,
  onUpdate,
}: DetailsBoxProps) {
  const handleStatusChange = async (status: ComplianceStatus) => {
    await updateListItemComplianceStatus(listItem.id, status)
    await onUpdate()
  }

  const handleResponsibleChange = async (userId: string | null) => {
    await updateListItemResponsible(listItem.id, userId)
    await onUpdate()
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          Detaljer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Document Number */}
        <div className="flex items-center justify-between min-h-[32px]">
          <span className="text-sm font-medium text-foreground/70">
            Dokumentnummer
          </span>
          <span className="text-sm font-mono">
            {listItem.legalDocument.documentNumber}
          </span>
        </div>

        {/* Category */}
        {listItem.category && (
          <div className="flex items-center justify-between min-h-[32px]">
            <span className="text-sm font-medium text-foreground/70">
              Kategori
            </span>
            <Badge variant="secondary" className="text-xs">
              {listItem.category}
            </Badge>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between min-h-[32px]">
          <span className="text-sm font-medium text-foreground/70">Status</span>
          <ComplianceStatusEditor
            value={listItem.complianceStatus}
            onChange={handleStatusChange}
            className="h-7"
          />
        </div>

        {/* Responsible */}
        <div className="flex items-center justify-between min-h-[32px]">
          <span className="text-sm font-medium text-foreground/70">
            Ansvarig
          </span>
          <div className="flex items-center gap-2">
            <ResponsibleEditor
              value={listItem.responsibleUser?.id ?? null}
              members={workspaceMembers}
              onChange={handleResponsibleChange}
            />
            {listItem.responsibleUser && (
              <span className="text-sm">
                {listItem.responsibleUser.name ??
                  listItem.responsibleUser.email}
              </span>
            )}
          </div>
        </div>

        {/* Due date (if set) */}
        {listItem.dueDate && (
          <div className="flex items-center justify-between min-h-[32px]">
            <span className="text-sm font-medium text-foreground/70">
              Deadline
            </span>
            <span className="text-sm">
              {format(new Date(listItem.dueDate), 'd MMM yyyy', { locale: sv })}
            </span>
          </div>
        )}

        {/* Created date */}
        <div className="flex items-center justify-between min-h-[32px]">
          <span className="text-sm font-medium text-foreground/70">Skapad</span>
          <span className="text-sm">
            {format(new Date(listItem.addedAt), 'd MMM yyyy', { locale: sv })}
          </span>
        </div>

        {/* Last updated */}
        <div className="flex items-center justify-between min-h-[32px]">
          <span className="text-sm font-medium text-foreground/70">
            Senast uppdaterad
          </span>
          <span
            className="text-sm"
            title={format(new Date(listItem.updatedAt), 'PPpp', { locale: sv })}
          >
            {formatDistanceToNow(new Date(listItem.updatedAt), {
              addSuffix: true,
              locale: sv,
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
