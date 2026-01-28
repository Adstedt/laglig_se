'use client'

/**
 * Story 6.6: Task Modal Left Panel
 * Scrollable left panel with title, description, attachments, and activity section
 * Description and attachments use Jira-style collapsible accordions
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { TaskTitleEditor } from './task-title-editor'
import { StatusPriorityBadges } from './status-priority-badges'
import { DescriptionEditor } from './description-editor'
import { EvidenceAccordion } from './evidence-accordion'
import { ActivityTabs } from './activity-tabs'
import { FileText, Paperclip } from 'lucide-react'
import type { TaskDetails } from '@/app/actions/task-modal'
import type { WorkspaceMember } from '../task-workspace'

interface LeftPanelProps {
  task: TaskDetails
  workspaceMembers: WorkspaceMember[]
  onUpdate: () => Promise<void>
  onOptimisticTitleChange?: ((_title: string) => void) | undefined
}

export function LeftPanel({
  task,
  workspaceMembers,
  onUpdate,
  onOptimisticTitleChange,
}: LeftPanelProps) {
  const attachmentCount = task.evidence.length

  return (
    <div className="p-6 space-y-4 border-r border-border/50">
      {/* Title + Badges - tighter spacing aligned with law list modal */}
      <div className="space-y-3">
        <TaskTitleEditor
          taskId={task.id}
          initialTitle={task.title}
          onUpdate={onUpdate}
          onOptimisticChange={onOptimisticTitleChange}
        />
        <StatusPriorityBadges
          status={task.column.name}
          statusColor={task.column.color}
          priority={task.priority}
          isDone={task.column.is_done}
        />
      </div>

      {/* Description and Attachments Accordions */}
      <Accordion
        type="multiple"
        defaultValue={['description']}
        className="space-y-2"
      >
        {/* Description Accordion - defaults to open */}
        <AccordionItem
          value="description"
          className="border rounded-lg border-border/60"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg data-[state=closed]:rounded-lg">
            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
              <FileText className="h-4 w-4" />
              <span>Beskrivning</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <DescriptionEditor
              taskId={task.id}
              initialDescription={task.description}
              onUpdate={onUpdate}
              hideLabel
              workspaceMembers={workspaceMembers}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Attachments Accordion - defaults to closed */}
        <AccordionItem
          value="attachments"
          className="border rounded-lg border-border/60"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg data-[state=closed]:rounded-lg">
            <div className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Paperclip className="h-4 w-4" />
              <span>Bilagor</span>
              {attachmentCount > 0 && (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {attachmentCount}
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <EvidenceAccordion
              taskId={task.id}
              evidence={task.evidence}
              onUpdate={onUpdate}
              embedded
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Activity Section with Tabs */}
      <ActivityTabs
        taskId={task.id}
        comments={task.comments}
        workspaceMembers={workspaceMembers}
        onUpdate={onUpdate}
      />
    </div>
  )
}
