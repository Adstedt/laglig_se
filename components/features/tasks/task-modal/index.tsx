'use client'

/**
 * Story 6.6: Task Modal (Jira-Style)
 * Full-featured task management modal with two-panel layout.
 *
 * Composition over the shared <SplitPanelModal> shell:
 * - Shell owns Dialog chrome, panel layout state (chat closed / open / expanded)
 *   and viewport fallback. This file wires task-specific data and slots.
 */

import { SplitPanelModal } from '@/components/shared/split-panel-modal'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ModalHeader } from './modal-header'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { AiChatPanel } from './ai-chat-panel'
import { ModalSkeleton } from './modal-skeleton'
import { RightPanelRail } from './right-panel-rail'
import { CompactTaskStrip } from './compact-task-strip'
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
  initialData?: InitialTaskData | null
  workspaceMembers?: WorkspaceMember[]
  columns?: TaskColumnWithCount[]
  onTaskUpdate?: (_taskId: string, _updates: Partial<TaskWithRelations>) => void
  onTaskDelete?: (_taskId: string) => void
  onOpenListItem?: ((_listItemId: string) => void) | undefined
}

export function TaskModal({
  taskId,
  onClose,
  initialData,
  workspaceMembers: preloadedMembers = [],
  columns: preloadedColumns = [],
  onTaskUpdate,
  onTaskDelete,
  onOpenListItem,
}: TaskModalProps) {
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

  const workspaceMembers = preloadedMembers
  const isOpen = taskId !== null

  return (
    <SplitPanelModal
      open={isOpen}
      onClose={onClose}
      srTitle={task?.title ?? 'Laddar uppgift...'}
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
        task ? (
          <ModalHeader
            taskTitle={task.title}
            taskId={task.id}
            onClose={onClose}
            onDelete={() => {
              if (taskId) onTaskDelete?.(taskId)
              onClose()
            }}
          />
        ) : null
      }
      leftPanel={
        task ? (
          <ScrollArea className="h-full min-w-0">
            <LeftPanel
              task={task}
              workspaceMembers={workspaceMembers}
              onUpdate={handleDataUpdate}
              onOptimisticTitleChange={(title) => {
                optimisticUpdateTitle(title)
                if (taskId) onTaskUpdate?.(taskId, { title })
              }}
              onOptimisticDescriptionChange={(description) => {
                if (taskId) onTaskUpdate?.(taskId, { description })
              }}
            />
          </ScrollArea>
        ) : null
      }
      rightPanel={
        task ? (
          <RightPanel
            task={task}
            workspaceMembers={workspaceMembers}
            columns={preloadedColumns}
            onUpdate={handleDataUpdate}
            onOptimisticStatusChange={(columnId) => {
              optimisticUpdateStatus(columnId)
              const column = preloadedColumns.find((c) => c.id === columnId)
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
              if (taskId)
                onTaskUpdate?.(taskId, {
                  priority: priority as TaskWithRelations['priority'],
                })
            }}
            onOptimisticAssigneeChange={(member) => {
              optimisticUpdateAssignee(
                member ? { ...member, avatarUrl: member.avatarUrl } : null
              )
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
              if (taskId) {
                onTaskUpdate?.(taskId, { due_date: dueDate })
              }
            }}
            onOptimisticLinksChange={(links) => {
              optimisticUpdateLinks(links)
            }}
            onOpenListItem={onOpenListItem}
          />
        ) : null
      }
      renderChat={
        task
          ? ({ expanded, onToggleExpand, onClose: closeChat }) => (
              <AiChatPanel
                taskTitle={task.title}
                taskId={task.id}
                taskDescription={task.description ?? undefined}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                onClose={closeChat}
              />
            )
          : undefined
      }
      renderRail={
        task
          ? ({ onExpandRail }) => (
              <RightPanelRail
                task={task}
                workspaceMembers={workspaceMembers}
                columns={preloadedColumns}
                onExpandRail={onExpandRail}
              />
            )
          : undefined
      }
      expandedHeader={
        task ? (
          <CompactTaskStrip task={task} columns={preloadedColumns} />
        ) : undefined
      }
    />
  )
}
