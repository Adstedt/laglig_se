'use client'

/**
 * Story 6.3: Left Panel
 * Story 6.15: Added TasksAccordion for bidirectional task linking
 * Scrollable panel with law header, lagtext, business context, tasks, and activity tabs
 */

import { useState, useEffect, useCallback } from 'react'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { Accordion } from '@/components/ui/accordion'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { LawHeader } from './law-header'
import { AccordionGroupLabel } from './accordion-group-label'
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

// Accordion item values. Ordered to mirror the on-screen group order
// (Efterlevnad → Referens → Underlag); the order here only affects the
// toggle-all spread — the visual layout/grouping lives in the JSX below.
const ACCORDION_ITEMS = [
  'business-context',
  'compliance-narrative',
  'kravpunkter',
  'lagtext',
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

/**
 * Collapsible left-panel groups. Persisted to localStorage so a folded-away
 * group stays folded across sessions/devices — a durable personal "focus
 * filter" (e.g. "hide the law text + underlag while I do compliance work").
 * Global (not per-law) on purpose: the fold is a working mode, not a per-law
 * setting. `focusField` and the right-panel deep-link shortcuts force the
 * relevant group open (see below) so content is never silently unreachable.
 */
type GroupId = 'efterlevnad' | 'referens' | 'underlag'
const GROUP_IDS: GroupId[] = ['efterlevnad', 'referens', 'underlag']
const COLLAPSED_GROUPS_KEY = 'laglig:legal-modal-collapsed-groups'

function loadCollapsedGroups(): GroupId[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(COLLAPSED_GROUPS_KEY) ?? '[]'
    )
    if (!Array.isArray(parsed)) return []
    return parsed.filter((g): g is GroupId =>
      (GROUP_IDS as string[]).includes(g)
    )
  } catch {
    return []
  }
}

function persistCollapsedGroups(groups: GroupId[]): void {
  try {
    window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(groups))
  } catch {
    // localStorage unavailable (private mode / quota) — fall back to in-memory
  }
}

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

  // Collapsible group state (localStorage-backed). A group id present here = folded.
  const [collapsedGroups, setCollapsedGroups] =
    useState<GroupId[]>(loadCollapsedGroups)

  const toggleGroup = useCallback((id: GroupId) => {
    setCollapsedGroups((prev) => {
      const next = prev.includes(id)
        ? prev.filter((g) => g !== id)
        : [...prev, id]
      persistCollapsedGroups(next)
      return next
    })
  }, [])

  const openGroup = useCallback((id: GroupId) => {
    setCollapsedGroups((prev) => {
      if (!prev.includes(id)) return prev
      const next = prev.filter((g) => g !== id)
      persistCollapsedGroups(next)
      return next
    })
  }, [])

  // Entry-point intent wins: if the modal opens focused on a field, make sure
  // its group is unfolded (all current focusFields live under "Efterlevnad").
  useEffect(() => {
    if (
      focusField === 'businessContext' ||
      focusField === 'complianceNarrative' ||
      focusField === 'kravpunkter'
    ) {
      openGroup('efterlevnad')
    }
  }, [focusField, openGroup])

  // Right-panel deep-link shortcuts scroll to a row inside a (maybe folded)
  // group. Unfold the group first, then re-scroll once it has expanded.
  useEffect(() => {
    const reveal = (group: GroupId, targetId: string) => {
      openGroup(group)
      window.setTimeout(() => {
        document
          .getElementById(targetId)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 240)
    }
    const onKrav = () => reveal('efterlevnad', 'kravpunkter-accordion')
    const onArtifacts = () => reveal('underlag', 'linked-artifacts-accordion')
    window.addEventListener('laglig:focus-kravpunkter', onKrav)
    window.addEventListener('laglig:focus-linked-artifacts', onArtifacts)
    return () => {
      window.removeEventListener('laglig:focus-kravpunkter', onKrav)
      window.removeEventListener('laglig:focus-linked-artifacts', onArtifacts)
    }
  }, [openGroup])

  // "Expand all" reveals everything (rows + any folded groups); "collapse all"
  // just closes the rows and leaves the group labels in place.
  const toggleAll = () => {
    if (allOpen) {
      setOpenItems([])
    } else {
      setOpenItems([...ACCORDION_ITEMS])
      setCollapsedGroups([])
      persistCollapsedGroups([])
    }
  }

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

      {/*
        Grouped accordions (Story 6.3 follow-up). Three collapsible groups give
        the panel hierarchy + a personal focus filter: the user's own compliance
        work, then the read-only law, then tasks & files. Each group is a
        <Collapsible> whose trigger is the group label; folded state persists in
        localStorage (see COLLAPSED_GROUPS_KEY). Items stay inside one Accordion
        root so its row state/keyboard nav are unaffected. (Group ids stay
        'efterlevnad'/'referens'/'underlag' internally even though the third
        label reads "Uppgifter & filer", so saved localStorage state is stable.)
          Efterlevnad:       business-context → compliance-narrative → kravpunkter
          Referens:          lagtext (the law itself, read-only reference)
          Uppgifter & filer: tasks → linked-artifacts
      */}
      <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
        <Collapsible
          open={!collapsedGroups.includes('efterlevnad')}
          onOpenChange={() => toggleGroup('efterlevnad')}
          className="mt-1 first:mt-0"
        >
          <CollapsibleTrigger asChild>
            <AccordionGroupLabel>Efterlevnad</AccordionGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
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
          </CollapsibleContent>
        </Collapsible>

        <Collapsible
          open={!collapsedGroups.includes('referens')}
          onOpenChange={() => toggleGroup('referens')}
          className="mt-4"
        >
          <CollapsibleTrigger asChild>
            <AccordionGroupLabel>Referens</AccordionGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {/* Lagtext Section */}
            <LagtextSection
              documentId={listItem.legalDocument.id}
              htmlContent={listItem.legalDocument.htmlContent}
              fullText={null}
              slug={listItem.legalDocument.slug}
              sourceUrl={listItem.legalDocument.sourceUrl}
              isLoading={isLoadingContent || false}
            />
          </CollapsibleContent>
        </Collapsible>

        <Collapsible
          open={!collapsedGroups.includes('underlag')}
          onOpenChange={() => toggleGroup('underlag')}
          className="mt-4"
        >
          <CollapsibleTrigger asChild>
            <AccordionGroupLabel>Uppgifter & filer</AccordionGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
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
              entity={{ type: 'list_item', id: listItem.id }}
              readOnly={complianceReadOnly}
            />
          </CollapsibleContent>
        </Collapsible>
      </Accordion>

      {/* Activity Tabs */}
      <ActivityTabs listItemId={listItem.id} currentUserId={currentUserId} />
    </div>
  )
}
