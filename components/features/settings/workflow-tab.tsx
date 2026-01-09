'use client'

/**
 * Story 6.5: Workflow Tab
 * Settings tab for managing Kanban column configuration.
 */

import { ColumnManager, ColumnManagerSkeleton } from './column-manager'
import type { TaskColumnWithCount } from '@/app/actions/tasks'

interface WorkflowTabProps {
  columns: TaskColumnWithCount[]
}

export function WorkflowTab({ columns }: WorkflowTabProps) {
  return (
    <div className="space-y-6">
      <ColumnManager initialColumns={columns} />
    </div>
  )
}

export function WorkflowTabSkeleton() {
  return (
    <div className="space-y-6">
      <ColumnManagerSkeleton />
    </div>
  )
}
