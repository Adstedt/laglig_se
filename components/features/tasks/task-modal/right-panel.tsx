'use client'

/**
 * Story 6.6: Task Modal Right Panel
 * Static right panel with details, quick links, linked laws, evidence, labels
 */

import { ScrollArea } from '@/components/ui/scroll-area'
import { DetailsBox } from './details-box'
import { QuickLinksBox } from './quick-links-box'
import { LinkedLawsBox } from './linked-laws-box'
import { LabelsBox } from './labels-box'
import { ModalFooter } from './modal-footer'
import type { TaskDetails } from '@/app/actions/task-modal'
import type { WorkspaceMember } from '../task-workspace'
import type { TaskColumnWithCount } from '@/app/actions/tasks'

interface RightPanelProps {
  task: TaskDetails
  workspaceMembers: WorkspaceMember[]
  columns: TaskColumnWithCount[]
  onUpdate: () => Promise<void>
  onAiChatToggle: () => void
  onClose: () => void
  // Optimistic update callbacks
  onOptimisticStatusChange?: ((_columnId: string) => void) | undefined
  onOptimisticPriorityChange?: ((_priority: string) => void) | undefined
  onOptimisticAssigneeChange?:
    | ((_member: WorkspaceMember | null) => void)
    | undefined
  onOptimisticDueDateChange?: ((_dueDate: Date | null) => void) | undefined
}

export function RightPanel({
  task,
  workspaceMembers,
  columns,
  onUpdate,
  onAiChatToggle,
  onClose,
  onOptimisticStatusChange,
  onOptimisticPriorityChange,
  onOptimisticAssigneeChange,
  onOptimisticDueDateChange,
}: RightPanelProps) {
  return (
    <div className="flex flex-col h-full bg-muted/30 md:border-l">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4">
          {/* Details Box */}
          <DetailsBox
            task={task}
            workspaceMembers={workspaceMembers}
            columns={columns}
            onUpdate={onUpdate}
            onOptimisticStatusChange={onOptimisticStatusChange}
            onOptimisticPriorityChange={onOptimisticPriorityChange}
            onOptimisticAssigneeChange={onOptimisticAssigneeChange}
            onOptimisticDueDateChange={onOptimisticDueDateChange}
          />

          {/* Quick Links Box */}
          <QuickLinksBox onAiChatToggle={onAiChatToggle} />

          {/* Linked Laws Box */}
          <LinkedLawsBox
            taskId={task.id}
            links={task.list_item_links}
            onUpdate={onUpdate}
          />

          {/* Labels Box */}
          <LabelsBox
            taskId={task.id}
            labels={task.labels}
            onUpdate={onUpdate}
          />
        </div>
      </ScrollArea>

      {/* Footer */}
      <ModalFooter
        taskId={task.id}
        createdAt={task.created_at}
        updatedAt={task.updated_at}
        creator={task.creator}
        onDelete={onClose}
      />
    </div>
  )
}
