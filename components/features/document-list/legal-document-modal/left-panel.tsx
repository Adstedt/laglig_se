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
import { ComplianceNarrative } from './compliance-narrative'
import { KravpunkterAccordion } from './kravpunkter-accordion'
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
  /** Story 20.3: scroll-to + briefly-highlight the matching krav row when the modal opens */
  focusRequirementId?: string | undefined
  isLoadingContent?: boolean
  taskProgress?: TaskProgress | null
  onTasksUpdate?: () => Promise<void>
  onOpenTask?: ((_taskId: string) => void) | undefined
  currentUserId?: string | undefined
  /** Story 6.15: Optimistic update callback for task list */
  onOptimisticTaskUpdate?: ((_tasks: TaskProgress['tasks']) => void) | undefined
  /** Task columns for inline status change in TasksAccordion */
  taskColumns?: TaskColumnWithCount[]
  /** Story 21.22: Name of user who last updated compliance narrative */
  complianceNarrativeUpdatedByName?: string | null
  /** Callback when business context changes (for optimistic list update) */
  onBusinessContextChange?: ((_content: string | null) => void) | undefined
  /** Story 21.22: Callback when compliance narrative changes */
  onComplianceNarrativeChange?: ((_content: string | null) => void) | undefined
  /** Field to focus/edit when modal opens (from "Lägg till" click) */
  focusField?:
    | 'businessContext'
    | 'complianceNarrative'
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

// Story 21.22: top-down compliance authoring flow:
// lagtext (the law) → business-context (how it affects us) → compliance-narrative
// (how we comply) → kravpunkter (specific requirements) → tasks → underlag.
const ACCORDION_ITEMS = [
  'lagtext',
  'business-context',
  'compliance-narrative',
  'kravpunkter',
  'tasks',
  'linked-artifacts',
] as const

/**
 * Quiet default: the modal lands with only "Hur påverkar detta oss?"
 * (business-context) expanded. Users can toggle-all via the header chevron
 * or expand individual accordions as needed. Overridden per focusField below.
 */
const DEFAULT_OPEN: string[] = ['business-context']

/**
 * When the modal is opened from the /krav page (focusField === 'kravpunkter'),
 * land with only the kravpunkter accordion expanded.
 */
const KRAVPUNKTER_FOCUS_OPEN: string[] = ['kravpunkter']

/**
 * Session-scoped last-used accordion state. Survives modal close/reopen
 * within the same tab (so "I'm in bevis-checking mode across several laws"
 * sticks), dies on page refresh. `focusField` always wins over this — entry-
 * point intent takes precedence. Module-scoped ref, no storage.
 */
let lastSessionOpen: string[] | null = null

export function LeftPanel({
  listItem,
  workspaceMembers,
  listItemResponsibleUserId,
  focusRequirementId,
  isLoadingContent,
  taskProgress,
  onTasksUpdate,
  onOpenTask,
  currentUserId,
  onOptimisticTaskUpdate,
  taskColumns = [],
  complianceNarrativeUpdatedByName,
  onBusinessContextChange,
  onComplianceNarrativeChange,
  focusField,
  complianceReadOnly,
  onKravpunkterProgressChange,
}: LeftPanelProps) {
  const [openItems, setOpenItemsState] = useState<string[]>(() => {
    // focusField wins — entry-point intent overrides any remembered state.
    if (focusField === 'kravpunkter') return KRAVPUNKTER_FOCUS_OPEN
    // Otherwise: last-used this session, falling back to the quiet default.
    return lastSessionOpen ?? DEFAULT_OPEN
  })
  // Wrap the setter so every accordion change updates the session memo too.
  const setOpenItems = (next: string[]) => {
    lastSessionOpen = next
    setOpenItemsState(next)
  }
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

        {/* Story 21.22: Hur efterlever vi kraven? — first-class compliance narrative */}
        <ComplianceNarrative
          listItemId={listItem.id}
          initialContent={listItem.complianceNarrative}
          updatedAt={listItem.complianceNarrativeUpdatedAt}
          updatedByName={complianceNarrativeUpdatedByName}
          onContentChange={onComplianceNarrativeChange}
          focusField={focusField}
          readOnly={complianceReadOnly}
        />

        {/* Story 17.16 + 21.22: Kravpunkter checklist (no longer bundles a free-text field) */}
        <KravpunkterAccordion
          listItemId={listItem.id}
          focusField={focusField}
          readOnly={complianceReadOnly}
          onProgressChange={onKravpunkterProgressChange}
          workspaceMembers={workspaceMembers}
          listItemResponsibleUserId={listItemResponsibleUserId ?? null}
          focusRequirementId={focusRequirementId}
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
