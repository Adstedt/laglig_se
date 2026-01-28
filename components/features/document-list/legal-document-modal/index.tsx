'use client'

/**
 * Story 6.3: Legal Document Modal
 * Jira-style deep workspace for managing compliance on a specific law
 *
 * Performance optimization: Accepts initialData from list view to display instantly,
 * only fetches missing data (htmlContent, businessContext, aiCommentary)
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { ModalHeader } from './modal-header'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { AiChatPanel } from './ai-chat-panel'
import { ModalSkeleton } from './modal-skeleton'
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
  /** Pre-loaded data from list view for instant display */
  initialData?: InitialListItemData | null
  /** Pre-loaded workspace members (fetch once at page level) */
  workspaceMembers?: WorkspaceMember[]
  /** Callback to open a task modal */
  onOpenTask?: ((_taskId: string) => void) | undefined
  /** Current user ID for "assign to me" functionality */
  currentUserId?: string
  /** Task columns for inline status change in TasksAccordion */
  taskColumns?: TaskColumnWithCount[]
}

export function LegalDocumentModal({
  listItemId,
  onClose,
  initialData,
  workspaceMembers: preloadedMembers,
  onOpenTask,
  currentUserId,
  taskColumns = [],
}: LegalDocumentModalProps) {
  const [aiChatOpen, setAiChatOpen] = useState(false)

  // Optimistic overrides for status/priority (header badges + details box stay in sync)
  const [overrides, setOverrides] = useState<{
    complianceStatus?: ComplianceStatus
    priority?: 'LOW' | 'MEDIUM' | 'HIGH'
  }>({})

  // Reset overrides when switching to a different list item
  useEffect(() => {
    setOverrides({})
  }, [listItemId])

  // Use SWR hook - pass initialData for instant display, only fetch missing data
  const {
    listItem: rawListItem,
    taskProgress,
    evidence,
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

  const handleOptimisticChange = useCallback(
    (fields: {
      complianceStatus?: ComplianceStatus
      priority?: 'LOW' | 'MEDIUM' | 'HIGH'
    }) => {
      setOverrides((prev) => ({ ...prev, ...fields }))
    },
    []
  )

  // Scroll to evidence tab
  const scrollToEvidenceTab = useCallback(() => {
    const evidenceTab = document.getElementById('activity-tab-bevis')
    if (evidenceTab) {
      evidenceTab.click()
    }
  }, [])

  const isOpen = listItemId !== null

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogPrimitive.Portal>
        {/* Custom lighter overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/30',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            // Position and z-index - centered
            'fixed top-[50%] left-[50%] z-50',
            'translate-x-[-50%] translate-y-[-50%]',
            // Base sizing - cap at 1280px max width
            'w-full max-h-[90vh] max-w-[min(80vw,1280px)] p-0 gap-0',
            // Styling - overflow visible to allow flyout, no border (children handle it)
            'bg-transparent shadow-none overflow-visible',
            // Remove focus outline
            'focus:outline-none focus-visible:outline-none',
            // Mobile full-screen
            'max-md:max-w-full max-md:max-h-full max-md:h-full max-md:overflow-hidden',
            // Simple fade animation only - no zoom to avoid transform conflicts
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200'
          )}
          onEscapeKeyDown={onClose}
          aria-describedby={undefined}
        >
          {/* Accessible title for screen readers */}
          <DialogTitle className="sr-only">
            {listItem?.legalDocument.title ?? 'Laddar...'}
          </DialogTitle>

          {isLoading ? (
            <ModalSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4 p-8">
              <p className="text-destructive">{error}</p>
              <button
                onClick={onClose}
                className="text-sm text-muted-foreground hover:underline"
              >
                Stäng
              </button>
            </div>
          ) : listItem ? (
            <div
              className={cn(
                // Wrapper for AI chat shift animation - separate from open animation
                'transition-transform duration-300 ease-in-out delay-75',
                aiChatOpen
                  ? 'lg:translate-x-[-160px] xl:translate-x-[-190px]'
                  : 'translate-x-0'
              )}
            >
              {/* Main modal content - z-10 ensures flyout slides from behind */}
              <div
                className={cn(
                  'relative z-10 flex flex-col h-full max-h-[90vh] max-md:max-h-full overflow-hidden',
                  'bg-background border shadow-lg rounded-lg',
                  'transition-[border-radius] duration-100',
                  aiChatOpen
                    ? 'lg:rounded-r-none lg:border-r-0 delay-200'
                    : 'delay-0'
                )}
              >
                {/* Header with breadcrumb and close button */}
                <ModalHeader
                  listName={listItem.lawList.name}
                  documentNumber={listItem.legalDocument.documentNumber}
                  slug={listItem.legalDocument.slug}
                  onClose={onClose}
                  aiChatOpen={aiChatOpen}
                  onAiChatToggle={() => setAiChatOpen(!aiChatOpen)}
                />

                {/* Two-panel layout */}
                <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-[3fr_2fr]">
                  {/* Left panel - scrollable (Story 6.15: tasks moved here) */}
                  <ScrollArea className="h-full">
                    <LeftPanel
                      listItem={listItem}
                      isLoadingContent={isLoadingContent}
                      taskProgress={taskProgress}
                      onTasksUpdate={handleTasksUpdate}
                      onOpenTask={onOpenTask}
                      currentUserId={currentUserId}
                      onOptimisticTaskUpdate={handleOptimisticTaskUpdate}
                      taskColumns={taskColumns}
                    />
                  </ScrollArea>

                  {/* Right panel - sticky on desktop, below on mobile */}
                  <RightPanel
                    listItem={listItem}
                    evidence={evidence}
                    workspaceMembers={workspaceMembers}
                    onUpdate={handleDataUpdate}
                    onEvidenceClick={scrollToEvidenceTab}
                    onAiChatToggle={() => setAiChatOpen(!aiChatOpen)}
                    onOptimisticChange={handleOptimisticChange}
                  />
                </div>
              </div>

              {/* AI Chat flyout - slides out from behind modal edge */}
              <div
                className={cn(
                  'hidden lg:block absolute top-0 bottom-0 left-full z-0',
                  'w-[320px] xl:w-[380px] transition-all duration-300 ease-out',
                  'rounded-r-lg overflow-hidden',
                  aiChatOpen
                    ? 'translate-x-0 opacity-100 shadow-lg'
                    : 'translate-x-[-100%] opacity-0 shadow-none pointer-events-none'
                )}
              >
                <AiChatPanel
                  documentTitle={listItem.legalDocument.title}
                  documentNumber={listItem.legalDocument.documentNumber}
                  onClose={() => setAiChatOpen(false)}
                />
              </div>
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
