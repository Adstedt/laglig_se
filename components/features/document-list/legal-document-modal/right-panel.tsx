'use client'

/**
 * Story 6.3: Right Panel
 * Story 6.15: Tasks moved to left panel accordion
 * Static panel with details, quick links, and evidence summary
 */

import { ScrollArea } from '@/components/ui/scroll-area'
import { DetailsBox } from './details-box'
import { QuickLinksBox } from './quick-links-box'
import { EvidenceSummaryBox } from './evidence-summary-box'
import type {
  ListItemDetails,
  EvidenceSummary,
} from '@/app/actions/legal-document-modal'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import type { ComplianceStatus } from '@prisma/client'

interface RightPanelProps {
  listItem: ListItemDetails
  evidence: EvidenceSummary[] | null
  workspaceMembers: WorkspaceMemberOption[]
  onUpdate: () => Promise<void>
  onEvidenceClick: () => void
  onAiChatToggle?: (() => void) | undefined
  onOptimisticChange?:
    | ((_fields: {
        complianceStatus?: ComplianceStatus
        priority?: 'LOW' | 'MEDIUM' | 'HIGH'
      }) => void)
    | undefined
}

export function RightPanel({
  listItem,
  evidence,
  workspaceMembers,
  onUpdate,
  onEvidenceClick,
  onAiChatToggle,
  onOptimisticChange,
}: RightPanelProps) {
  return (
    <div className="border-l bg-muted/30 max-md:border-t max-md:border-l-0">
      <ScrollArea className="h-full max-h-[calc(90vh-60px)] max-md:max-h-none">
        <div className="p-6 space-y-6">
          {/* Details Box */}
          <DetailsBox
            listItem={listItem}
            workspaceMembers={workspaceMembers}
            onUpdate={onUpdate}
            onOptimisticChange={onOptimisticChange}
          />

          {/* Quick Links Box */}
          <QuickLinksBox
            slug={listItem.legalDocument.slug}
            contentType={listItem.legalDocument.contentType}
            documentNumber={listItem.legalDocument.documentNumber}
            listItemId={listItem.id}
            onAiChatToggle={onAiChatToggle}
          />

          {/* Evidence Summary Box */}
          <EvidenceSummaryBox evidence={evidence} onViewAll={onEvidenceClick} />
        </div>
      </ScrollArea>
    </div>
  )
}
