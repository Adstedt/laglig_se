'use client'

/**
 * Story 6.3: Left Panel
 * Story 6.15: Added TasksAccordion for bidirectional task linking
 * Scrollable panel with law header, lagtext, business context, tasks, and activity tabs
 */

import { Accordion } from '@/components/ui/accordion'
import { LawHeader } from './law-header'
import { LagtextSection } from './lagtext-section'
import { BusinessContext } from './business-context'
import { TasksAccordion } from './tasks-accordion'
import { ActivityTabs } from './activity-tabs'
import type {
  ListItemDetails,
  TaskProgress,
} from '@/app/actions/legal-document-modal'
import type { TaskColumnWithCount } from '@/app/actions/tasks'

interface LeftPanelProps {
  listItem: ListItemDetails
  isLoadingContent?: boolean
  taskProgress?: TaskProgress | null
  onTasksUpdate?: () => Promise<void>
  onOpenTask?: ((_taskId: string) => void) | undefined
  currentUserId?: string | undefined
  /** Story 6.15: Optimistic update callback for task list */
  onOptimisticTaskUpdate?: ((_tasks: TaskProgress['tasks']) => void) | undefined
  /** Task columns for inline status change in TasksAccordion */
  taskColumns?: TaskColumnWithCount[]
}

export function LeftPanel({
  listItem,
  isLoadingContent,
  taskProgress,
  onTasksUpdate,
  onOpenTask,
  currentUserId,
  onOptimisticTaskUpdate,
  taskColumns = [],
}: LeftPanelProps) {
  return (
    <div className="p-6 space-y-4">
      {/* Law Header */}
      <LawHeader
        title={listItem.legalDocument.title}
        aiCommentary={listItem.aiCommentary}
      />

      {/* Lagtext, Business Context, and Tasks Accordions */}
      <Accordion
        type="multiple"
        defaultValue={['business-context', 'tasks']}
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
      </Accordion>

      {/* Activity Tabs */}
      <ActivityTabs listItemId={listItem.id} />
    </div>
  )
}
