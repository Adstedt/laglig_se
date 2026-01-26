'use client'

/**
 * Story 6.6: Task Modal (Jira-Style)
 * Full-featured task management modal with two-panel layout
 *
 * Layout: Left panel (60%) scrollable content, Right panel (40%) static details
 * Features: Inline editing, threaded comments, activity history, AI chat flyout
 *
 * Performance optimization: Uses SWR for caching and optimistic updates
 * - Accepts initialData from Kanban/List view for instant display
 * - Caches task data for 30 seconds
 * - Supports optimistic updates for status, priority, title changes
 */

import { useState } from 'react'
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
  useTaskDetails,
  type InitialTaskData,
} from '@/lib/hooks/use-task-details'
import type {
  TaskColumnWithCount,
  TaskWithRelations,
} from '@/app/actions/tasks'
import type { WorkspaceMember } from '../task-workspace'

interface TaskModalProps {
  taskId: string | null
  onClose: () => void
  /** Pre-loaded data from Kanban/List view for instant display */
  initialData?: InitialTaskData | null
  /** Pre-loaded workspace members (fetch once at page level) */
  workspaceMembers?: WorkspaceMember[]
  /** Pre-loaded task columns for status dropdown */
  columns?: TaskColumnWithCount[]
  /** Callback when task is updated - syncs changes back to parent workspace */
  onTaskUpdate?: (_taskId: string, _updates: Partial<TaskWithRelations>) => void
}

export function TaskModal({
  taskId,
  onClose,
  initialData,
  workspaceMembers: preloadedMembers = [],
  columns: preloadedColumns = [],
  onTaskUpdate,
}: TaskModalProps) {
  const [aiChatOpen, setAiChatOpen] = useState(false)

  // Use SWR hook - pass initialData for instant display
  const {
    task,
    isLoading,
    error,
    mutate: handleDataUpdate,
    optimisticUpdateStatus,
    optimisticUpdatePriority,
    optimisticUpdateTitle,
    optimisticUpdateAssignee,
    optimisticUpdateDueDate,
    optimisticUpdateLinks,
  } = useTaskDetails(taskId, initialData, preloadedMembers, preloadedColumns)

  // Workspace members for child components
  const workspaceMembers = preloadedMembers

  const isOpen = taskId !== null

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
            {task?.title ?? 'Laddar uppgift...'}
          </DialogTitle>

          {isLoading ? (
            <ModalSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-[50vh] gap-4 p-8 bg-background border rounded-lg">
              <p className="text-destructive">{error}</p>
              <button
                onClick={onClose}
                className="text-sm text-muted-foreground hover:underline"
              >
                Stäng
              </button>
            </div>
          ) : task ? (
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
                    ? 'lg:rounded-r-none lg:border-r-transparent delay-200'
                    : 'delay-0'
                )}
              >
                {/* Header with breadcrumb and close button */}
                <ModalHeader
                  taskTitle={task.title}
                  onClose={onClose}
                  aiChatOpen={aiChatOpen}
                  onAiChatToggle={() => setAiChatOpen(!aiChatOpen)}
                />

                {/* Two-panel layout */}
                <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-[3fr_2fr] overflow-hidden">
                  {/* Left panel - scrollable */}
                  <ScrollArea className="h-full min-w-0">
                    <LeftPanel
                      task={task}
                      workspaceMembers={workspaceMembers}
                      onUpdate={handleDataUpdate}
                      onOptimisticTitleChange={(title) => {
                        optimisticUpdateTitle(title)
                        // Sync back to parent workspace
                        if (taskId) onTaskUpdate?.(taskId, { title })
                      }}
                    />
                  </ScrollArea>

                  {/* Right panel - sticky on desktop, below on mobile */}
                  <RightPanel
                    task={task}
                    workspaceMembers={workspaceMembers}
                    columns={preloadedColumns}
                    onUpdate={handleDataUpdate}
                    onAiChatToggle={() => setAiChatOpen(!aiChatOpen)}
                    onOptimisticStatusChange={(columnId) => {
                      optimisticUpdateStatus(columnId)
                      // Sync back to parent workspace
                      const column = preloadedColumns.find(
                        (c) => c.id === columnId
                      )
                      if (taskId && column) {
                        onTaskUpdate?.(taskId, {
                          column_id: columnId,
                          column: {
                            id: column.id,
                            name: column.name,
                            color: column.color,
                            is_done: column.is_done,
                          },
                        })
                      }
                    }}
                    onOptimisticPriorityChange={(priority) => {
                      optimisticUpdatePriority(priority)
                      // Sync back to parent workspace
                      if (taskId)
                        onTaskUpdate?.(taskId, {
                          priority: priority as TaskWithRelations['priority'],
                        })
                    }}
                    onOptimisticAssigneeChange={(member) => {
                      optimisticUpdateAssignee(
                        member
                          ? { ...member, avatarUrl: member.avatarUrl }
                          : null
                      )
                      // Sync back to parent workspace
                      if (taskId) {
                        onTaskUpdate?.(taskId, {
                          assignee_id: member?.id ?? null,
                          assignee: member
                            ? {
                                id: member.id,
                                name: member.name,
                                email: member.email,
                                avatar_url: member.avatarUrl,
                              }
                            : null,
                        })
                      }
                    }}
                    onOptimisticDueDateChange={(dueDate) => {
                      optimisticUpdateDueDate(dueDate)
                      // Sync back to parent workspace
                      if (taskId) {
                        onTaskUpdate?.(taskId, { due_date: dueDate })
                      }
                    }}
                    onOptimisticLinksChange={(links) => {
                      optimisticUpdateLinks(links)
                    }}
                  />
                </div>
              </div>

              {/* AI Chat flyout - slides out from behind modal edge */}
              <div
                className={cn(
                  'hidden lg:block absolute top-0 bottom-0 left-full z-0',
                  'w-[320px] xl:w-[380px] transition-all duration-300 ease-out',
                  aiChatOpen
                    ? 'translate-x-0 opacity-100 shadow-lg'
                    : 'translate-x-[-100%] opacity-0 shadow-none pointer-events-none'
                )}
              >
                <AiChatPanel
                  taskTitle={task.title}
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
