'use client'

/**
 * Story 6.3: Left Panel
 * Story 6.15: Added TasksAccordion for bidirectional task linking
 * Scrollable panel with law header, lagtext, business context, tasks, and activity tabs
 */

import { useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { LawHeader } from './law-header'
import { LagtextSection } from './lagtext-section'
import { BusinessContext } from './business-context'
import { ComplianceActions } from './compliance-actions'
import type { KravpunkterProgress } from './kravpunkter-checklist'
import { TasksAccordion } from './tasks-accordion'
import { LinkedArtifactsPanel } from './linked-artifacts-panel'
import { ActivityTabs } from './activity-tabs'
import type {
  ListItemDetails,
  TaskProgress,
} from '@/app/actions/legal-document-modal'
import type { TaskColumnWithCount } from '@/app/actions/tasks'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'

interface LeftPanelProps {
  listItem: ListItemDetails
  /** Story 20.1: threaded to KravpunkterChecklist for per-krav assignee picker */
  workspaceMembers?: WorkspaceMemberOption[] | undefined
  /** Story 20.1: parent law item's responsible_user_id — powers inherited-state visual */
  listItemResponsibleUserId?: string | null | undefined
  isLoadingContent?: boolean
  taskProgress?: TaskProgress | null
  onTasksUpdate?: () => Promise<void>
  onOpenTask?: ((_taskId: string) => void) | undefined
  currentUserId?: string | undefined
  /** Story 6.15: Optimistic update callback for task list */
  onOptimisticTaskUpdate?: ((_tasks: TaskProgress['tasks']) => void) | undefined
  /** Task columns for inline status change in TasksAccordion */
  taskColumns?: TaskColumnWithCount[]
  /** Story 6.18: Name of user who last updated compliance actions */
  complianceActionsUpdatedByName?: string | null
  /** Story 6.18: Callback when business context changes (for optimistic list update) */
  onBusinessContextChange?: ((_content: string | null) => void) | undefined
  /** Story 6.18: Callback when compliance actions changes (for optimistic list update) */
  onComplianceActionsChange?: ((_content: string | null) => void) | undefined
  /** Story 6.18 + 17.18: Field to focus/edit when modal opens (from "Lägg till" click) */
  focusField?:
    | 'businessContext'
    | 'complianceActions'
    | 'kravpunkter'
    | null
    | undefined
  /** Story 17.16: Read-only compliance editing when user lacks permission */
  complianceReadOnly?: boolean | undefined
  /** Story 17.16: Bubble kravpunkter progress up to modal for DetailsBox */
  onKravpunkterProgressChange?:
    | ((_progress: KravpunkterProgress) => void)
    | undefined
}

const ACCORDION_ITEMS = [
  'lagtext',
  'business-context',
  'compliance-actions',
  'tasks',
  'linked-artifacts',
] as const

const DEFAULT_OPEN: string[] = [
  'business-context',
  'compliance-actions',
  'tasks',
  'linked-artifacts',
]

export function LeftPanel({
  listItem,
  workspaceMembers,
  listItemResponsibleUserId,
  isLoadingContent,
  taskProgress,
  onTasksUpdate,
  onOpenTask,
  currentUserId,
  onOptimisticTaskUpdate,
  taskColumns = [],
  complianceActionsUpdatedByName,
  onBusinessContextChange,
  onComplianceActionsChange,
  focusField,
  complianceReadOnly,
  onKravpunkterProgressChange,
}: LeftPanelProps) {
  const [openItems, setOpenItems] = useState<string[]>(DEFAULT_OPEN)
  const allOpen = openItems.length === ACCORDION_ITEMS.length
  const toggleAll = () => setOpenItems(allOpen ? [] : [...ACCORDION_ITEMS])

  return (
    <div className="p-6 space-y-4 overflow-hidden">
      {/* Law Header */}
      <LawHeader
        title={listItem.legalDocument.title}
        aiCommentary={listItem.aiCommentary}
        complianceStatus={listItem.complianceStatus}
        priority={listItem.priority}
        headerActions={
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleAll}
                  aria-label={allOpen ? 'Fäll ihop alla' : 'Expandera alla'}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  {allOpen ? (
                    <ChevronsDownUp className="h-4 w-4" />
                  ) : (
                    <ChevronsUpDown className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                {allOpen ? 'Fäll ihop alla' : 'Expandera alla'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      />

      {/* Lagtext, Business Context, and Tasks Accordions */}
      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={setOpenItems}
        className="space-y-2"
      >
        {/* Lagtext Section */}
        <LagtextSection
          documentId={listItem.legalDocument.id}
          htmlContent={listItem.legalDocument.htmlContent}
          fullText={null}
          slug={listItem.legalDocument.slug}
          sourceUrl={listItem.legalDocument.sourceUrl}
          isLoading={isLoadingContent || false}
        />

        {/* Business Context */}
        <BusinessContext
          listItemId={listItem.id}
          initialContent={listItem.businessContext}
          onContentChange={onBusinessContextChange}
          autoEdit={focusField === 'businessContext'}
        />

        {/* Story 6.18 + 17.16 + 17.18: Compliance accordion (Kravpunkter + Kommentar) */}
        <ComplianceActions
          listItemId={listItem.id}
          initialContent={listItem.complianceActions}
          updatedAt={listItem.complianceActionsUpdatedAt}
          updatedByName={complianceActionsUpdatedByName}
          onContentChange={onComplianceActionsChange}
          focusField={focusField}
          readOnly={complianceReadOnly}
          onProgressChange={onKravpunkterProgressChange}
          workspaceMembers={workspaceMembers}
          listItemResponsibleUserId={listItemResponsibleUserId ?? null}
        />

        {/* Story 6.15: Tasks Accordion */}
        {onTasksUpdate && (
          <TasksAccordion
            taskProgress={taskProgress ?? null}
            listItemId={listItem.id}
            onTasksUpdate={onTasksUpdate}
            onOpenTask={onOpenTask}
            currentUserId={currentUserId}
            onOptimisticUpdate={onOptimisticTaskUpdate}
            columns={taskColumns}
          />
        )}

        {/* Story 17.18: Consolidated linked artifacts panel */}
        <LinkedArtifactsPanel
          listItemId={listItem.id}
          readOnly={complianceReadOnly}
        />
      </Accordion>

      {/* Activity Tabs */}
      <ActivityTabs listItemId={listItem.id} currentUserId={currentUserId} />
    </div>
  )
}
