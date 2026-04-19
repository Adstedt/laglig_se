'use client'

/**
 * Story 6.6: Task Modal Left Panel
 * Scrollable left panel with title, description, attachments, and activity section
 * Description and attachments use Jira-style collapsible accordions
 */

import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { TaskTitleEditor } from './task-title-editor'
import { StatusPriorityBadges } from './status-priority-badges'
import { DescriptionEditor } from './description-editor'
import { EvidenceAccordion } from './evidence-accordion'
import { ActivityTabs } from './activity-tabs'
import {
  FileText,
  Paperclip,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react'
import type { TaskDetails } from '@/app/actions/task-modal'
import type { WorkspaceMember } from '../task-workspace'

const ACCORDION_ITEMS = ['description', 'attachments'] as const

interface LeftPanelProps {
  task: TaskDetails
  workspaceMembers: WorkspaceMember[]
  onUpdate: () => Promise<void>
  onOptimisticTitleChange?: ((_title: string) => void) | undefined
  onOptimisticDescriptionChange?:
    | ((_description: string | null) => void)
    | undefined
}

export function LeftPanel({
  task,
  workspaceMembers,
  onUpdate,
  onOptimisticTitleChange,
  onOptimisticDescriptionChange,
}: LeftPanelProps) {
  const attachmentCount = task.evidence.length
  const [openItems, setOpenItems] = useState<string[]>(['description'])
  const allOpen = openItems.length === ACCORDION_ITEMS.length
  const toggleAll = () => setOpenItems(allOpen ? [] : [...ACCORDION_ITEMS])

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
      </div>

      {/* Description and Attachments Accordions */}
      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={setOpenItems}
        className="space-y-2"
      >
        {/* Description Accordion - defaults to open */}
        <AccordionItem
          value="description"
          className="border rounded-lg border-border/60"
        >
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg data-[state=closed]:rounded-lg">
            <div className="flex items-center gap-2 text-base font-semibold text-foreground flex-1">
              <FileText className="h-4 w-4" />
              <span>Beskrivning</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <DescriptionEditor
              taskId={task.id}
              initialDescription={task.description}
              onUpdate={onUpdate}
              onOptimisticChange={onOptimisticDescriptionChange}
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
            <div className="flex items-center gap-2 text-base font-semibold text-foreground flex-1">
              <Paperclip className="h-4 w-4" />
              <span>Bilagor</span>
              {attachmentCount > 0 && (
                <span className="ml-auto mr-2 text-xs text-muted-foreground tabular-nums font-normal">
                  {attachmentCount}
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
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
