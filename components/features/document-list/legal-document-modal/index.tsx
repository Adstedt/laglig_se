'use client'

/**
 * Story 6.3: Legal Document Modal
 * Jira-style deep workspace for managing compliance on a specific law
 *
 * Composition over the shared <SplitPanelModal> shell. The shell owns
 * the Dialog chrome and panel-layout states; this file wires law-specific
 * data, optimistic overrides, and the pending-changes banner.
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { SplitPanelModal } from '@/components/shared/split-panel-modal'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ModalHeader } from './modal-header'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { AiChatPanel } from './ai-chat-panel'
import { ModalSkeleton } from './modal-skeleton'
import { RightPanelRail } from './right-panel-rail'
import { CompactLawStrip } from './compact-law-strip'
import {
  useListItemDetails,
  type InitialListItemData,
  type WorkspaceMember,
} from '@/lib/hooks/use-list-item-details'
import type { TaskColumnWithCount } from '@/app/actions/tasks'
import type { ComplianceStatus } from '@prisma/client'

interface LegalDocumentModalProps {
  listItemId: string | null
  onClose: () => void
  initialData?: InitialListItemData | null
  workspaceMembers?: WorkspaceMember[]
  onOpenTask?: ((_taskId: string) => void) | undefined
  currentUserId?: string
  taskColumns?: TaskColumnWithCount[]
  onListItemChange?:
    | ((
        _listItemId: string,
        _updates: {
          complianceStatus?: ComplianceStatus
          priority?: 'LOW' | 'MEDIUM' | 'HIGH'
          responsibleUserId?: string | null
          businessContext?: string | null
          complianceActions?: string | null
        }
      ) => void)
    | undefined
  focusField?:
    | 'businessContext'
    | 'complianceActions'
    | 'kravpunkter'
    | null
    | undefined
  complianceReadOnly?: boolean | undefined
}

export function LegalDocumentModal({
  listItemId,
  onClose,
  initialData,
  workspaceMembers: preloadedMembers,
  onOpenTask,
  currentUserId,
  taskColumns = [],
  onListItemChange,
  focusField,
  complianceReadOnly,
}: LegalDocumentModalProps) {
  // Optimistic overrides for status/priority (header badges + details box stay in sync)
  const [overrides, setOverrides] = useState<{
    complianceStatus?: ComplianceStatus
    priority?: 'LOW' | 'MEDIUM' | 'HIGH'
  }>({})

  // Story 17.16: Kravpunkter progress lifted from KravpunkterChecklist so DetailsBox
  // can render a status-suggestion tooltip next to the Efterlevnad dropdown.
  const [requirementProgress, setRequirementProgress] = useState<{
    fulfilled: number
    total: number
  }>({ fulfilled: 0, total: 0 })

  // Reset overrides when switching to a different list item
  useEffect(() => {
    setOverrides({})
  }, [listItemId])

  const {
    listItem: rawListItem,
    taskProgress,
    workspaceMembers,
    isLoading,
    isLoadingContent,
    error,
    mutate: handleDataUpdate,
    mutateTaskProgress: handleTasksUpdate,
    optimisticTaskUpdate: handleOptimisticTaskUpdate,
  } = useListItemDetails(listItemId, initialData, preloadedMembers)

  // Merge optimistic overrides into listItem
  const listItem = useMemo(() => {
    if (!rawListItem) return null
    if (!overrides.complianceStatus && !overrides.priority) return rawListItem
    return {
      ...rawListItem,
      complianceStatus:
        overrides.complianceStatus ?? rawListItem.complianceStatus,
      priority: overrides.priority ?? rawListItem.priority,
    }
  }, [rawListItem, overrides])

  // Story 6.18: Resolve compliance actions updated by user name
  const complianceActionsUpdatedByName = useMemo(() => {
    if (!rawListItem?.complianceActionsUpdatedBy || !workspaceMembers) {
      return null
    }
    const user = workspaceMembers.find(
      (m) => m.id === rawListItem.complianceActionsUpdatedBy
    )
    return user?.name ?? user?.email ?? null
  }, [rawListItem?.complianceActionsUpdatedBy, workspaceMembers])

  const handleOptimisticChange = useCallback(
    (fields: {
      complianceStatus?: ComplianceStatus
      priority?: 'LOW' | 'MEDIUM' | 'HIGH'
    }) => {
      setOverrides((prev) => ({ ...prev, ...fields }))
    },
    []
  )

  const handleListItemChange = useCallback(
    (updates: {
      complianceStatus?: ComplianceStatus
      priority?: 'LOW' | 'MEDIUM' | 'HIGH'
      responsibleUserId?: string | null
    }) => {
      if (listItemId && onListItemChange) {
        onListItemChange(listItemId, updates)
      }
    },
    [listItemId, onListItemChange]
  )

  const handleBusinessContextChange = useCallback(
    (content: string | null) => {
      if (listItemId && onListItemChange) {
        onListItemChange(listItemId, { businessContext: content })
      }
    },
    [listItemId, onListItemChange]
  )

  const handleComplianceActionsChange = useCallback(
    (content: string | null) => {
      if (listItemId && onListItemChange) {
        onListItemChange(listItemId, { complianceActions: content })
      }
    },
    [listItemId, onListItemChange]
  )

  const scrollToLinkedArtifacts = useCallback(() => {
    const target = document.getElementById('linked-artifacts-accordion')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.dispatchEvent(new CustomEvent('laglig:focus-linked-artifacts'))
  }, [])

  const scrollToKravpunkter = useCallback(() => {
    const target = document.getElementById('kravpunkter-accordion')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.dispatchEvent(new CustomEvent('laglig:focus-kravpunkter'))
  }, [])

  const isOpen = listItemId !== null

  const pendingChangeCount = initialData?.pendingChangeCount
  const pendingChangeBanner =
    pendingChangeCount && pendingChangeCount > 0 && initialData ? (
      <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Denna lag har{' '}
          {pendingChangeCount === 1
            ? '1 oläst ändring'
            : `${pendingChangeCount} olästa ändringar`}
        </span>
        <Link
          href={`/laglistor?tab=changes&document=${initialData.document.id}`}
          className="ml-auto shrink-0 text-xs font-medium underline hover:no-underline"
          onClick={onClose}
        >
          Visa ändringar
        </Link>
      </div>
    ) : undefined

  return (
    <SplitPanelModal
      open={isOpen}
      onClose={onClose}
      srTitle={listItem?.legalDocument.title ?? 'Laddar...'}
      loading={isLoading ? <ModalSkeleton /> : undefined}
      error={
        error ? (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-4 p-8 bg-background border rounded-lg">
            <p className="text-destructive">{error}</p>
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:underline"
            >
              Stäng
            </button>
          </div>
        ) : undefined
      }
      header={
        listItem ? (
          <ModalHeader
            listName={listItem.lawList.name}
            documentNumber={listItem.legalDocument.documentNumber}
            slug={listItem.legalDocument.slug}
            onClose={onClose}
          />
        ) : null
      }
      banner={pendingChangeBanner}
      leftPanel={
        listItem ? (
          <ScrollArea className="h-full min-w-0 [&>div>div]:!block [&>div>div]:!min-w-0">
            <LeftPanel
              listItem={listItem}
              workspaceMembers={workspaceMembers}
              listItemResponsibleUserId={listItem.responsibleUser?.id ?? null}
              isLoadingContent={isLoadingContent}
              taskProgress={taskProgress}
              onTasksUpdate={handleTasksUpdate}
              onOpenTask={onOpenTask}
              currentUserId={currentUserId}
              onOptimisticTaskUpdate={handleOptimisticTaskUpdate}
              taskColumns={taskColumns}
              complianceActionsUpdatedByName={complianceActionsUpdatedByName}
              onBusinessContextChange={handleBusinessContextChange}
              onComplianceActionsChange={handleComplianceActionsChange}
              focusField={focusField}
              complianceReadOnly={complianceReadOnly}
              onKravpunkterProgressChange={setRequirementProgress}
            />
          </ScrollArea>
        ) : null
      }
      rightPanel={
        listItem ? (
          <RightPanel
            listItem={listItem}
            workspaceMembers={workspaceMembers}
            onUpdate={handleDataUpdate}
            onLinkedArtifactsClick={scrollToLinkedArtifacts}
            onKravpunkterGapClick={scrollToKravpunkter}
            onOptimisticChange={handleOptimisticChange}
            onListItemChange={handleListItemChange}
            requirementProgress={requirementProgress}
          />
        ) : null
      }
      renderChat={
        listItem
          ? ({ expanded, onToggleExpand, onClose: closeChat }) => (
              <AiChatPanel
                documentTitle={listItem.legalDocument.title}
                documentNumber={listItem.legalDocument.documentNumber}
                listItemId={listItem.id}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                onClose={closeChat}
              />
            )
          : undefined
      }
      renderRail={
        listItem
          ? ({ onExpandRail }) => (
              <RightPanelRail listItem={listItem} onExpandRail={onExpandRail} />
            )
          : undefined
      }
      expandedHeader={
        listItem ? <CompactLawStrip listItem={listItem} /> : undefined
      }
    />
  )
}
