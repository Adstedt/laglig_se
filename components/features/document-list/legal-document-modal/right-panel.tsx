'use client'

/**
 * Story 6.3: Right Panel
 * Story 6.15: Tasks moved to left panel accordion
 * Story 17.18: Bevis card replaced by ComplianceHealthBox; evidence prop removed.
 */

import { ScrollArea } from '@/components/ui/scroll-area'
import { DetailsBox } from './details-box'
import { QuickLinksBox } from './quick-links-box'
import { ComplianceHealthBox } from './compliance-health-box'
import type { ListItemDetails } from '@/app/actions/legal-document-modal'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import type { ComplianceStatus } from '@prisma/client'

interface RightPanelProps {
  listItem: ListItemDetails
  workspaceMembers: WorkspaceMemberOption[]
  onUpdate: () => Promise<void>
  onLinkedArtifactsClick: () => void
  onKravpunkterGapClick: () => void
  onOptimisticChange?:
    | ((_fields: {
        complianceStatus?: ComplianceStatus
        priority?: 'LOW' | 'MEDIUM' | 'HIGH'
      }) => void)
    | undefined
  /** Notify parent to update document list (modal → list optimistic update) */
  onListItemChange?:
    | ((_updates: {
        complianceStatus?: ComplianceStatus
        priority?: 'LOW' | 'MEDIUM' | 'HIGH'
        responsibleUserId?: string | null
      }) => void)
    | undefined
  /** Story 17.16: Kravpunkter progress — powers the DetailsBox status suggestion tooltip */
  requirementProgress?: { fulfilled: number; total: number } | undefined
}

export function RightPanel({
  listItem,
  workspaceMembers,
  onUpdate,
  onLinkedArtifactsClick,
  onKravpunkterGapClick,
  onOptimisticChange,
  onListItemChange,
  requirementProgress,
}: RightPanelProps) {
  return (
    <div className="h-full border-l bg-muted/30 max-md:border-t max-md:border-l-0">
      <ScrollArea className="h-full max-h-[calc(90vh-60px)] max-md:max-h-none">
        <div className="p-6 space-y-6">
          {/* Details Box */}
          <DetailsBox
            listItem={listItem}
            workspaceMembers={workspaceMembers}
            onUpdate={onUpdate}
            onOptimisticChange={onOptimisticChange}
            onListItemChange={onListItemChange}
            requirementProgress={requirementProgress}
          />

          {/* Quick Links Box */}
          <QuickLinksBox
            slug={listItem.legalDocument.slug}
            contentType={listItem.legalDocument.contentType}
            documentNumber={listItem.legalDocument.documentNumber}
            listItemId={listItem.id}
          />

          {/* Compliance Health Box */}
          <ComplianceHealthBox
            listItemId={listItem.id}
            onLinkedArtifactsClick={onLinkedArtifactsClick}
            onKravpunkterGapClick={onKravpunkterGapClick}
          />
        </div>
      </ScrollArea>
    </div>
  )
}
