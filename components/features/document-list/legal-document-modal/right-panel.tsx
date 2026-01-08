'use client'

/**
 * Story 6.3: Right Panel
 * Static panel with details, quick links, tasks summary, and evidence summary
 */

import { ScrollArea } from '@/components/ui/scroll-area'
import { DetailsBox } from './details-box'
import { QuickLinksBox } from './quick-links-box'
import { TasksSummaryBox } from './tasks-summary-box'
import { EvidenceSummaryBox } from './evidence-summary-box'
import type {
  ListItemDetails,
  TaskProgress,
  EvidenceSummary,
} from '@/app/actions/legal-document-modal'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'

interface RightPanelProps {
  listItem: ListItemDetails
  taskProgress: TaskProgress | null
  evidence: EvidenceSummary[] | null
  workspaceMembers: WorkspaceMemberOption[]
  onUpdate: () => Promise<void>
  onTasksUpdate: () => Promise<void>
  onEvidenceClick: () => void
  onAiChatToggle?: (() => void) | undefined
}

export function RightPanel({
  listItem,
  taskProgress,
  evidence,
  workspaceMembers,
  onUpdate,
  onTasksUpdate,
  onEvidenceClick,
  onAiChatToggle,
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
          />

          {/* Quick Links Box */}
          <QuickLinksBox
            slug={listItem.legalDocument.slug}
            contentType={listItem.legalDocument.contentType}
            documentNumber={listItem.legalDocument.documentNumber}
            listItemId={listItem.id}
            onAiChatToggle={onAiChatToggle}
          />

          {/* Tasks Summary Box */}
          <TasksSummaryBox
            taskProgress={taskProgress}
            listItemId={listItem.id}
            onTasksUpdate={onTasksUpdate}
          />

          {/* Evidence Summary Box */}
          <EvidenceSummaryBox evidence={evidence} onViewAll={onEvidenceClick} />
        </div>
      </ScrollArea>
    </div>
  )
}
