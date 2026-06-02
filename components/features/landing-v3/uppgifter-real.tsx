'use client'

/**
 * Uppgifter showcase body — the REAL tasks Kanban board (`KanbanTab`) fed mocked
 * tasks, under a page header that mirrors `/tasks`. The card view reads more
 * clearly in a marketing shot than the dense list. No fetch on mount;
 * `pointer-events-none` neutralises drag/edit so it's a static screenshot.
 */
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { KanbanTab } from '@/components/features/tasks/task-workspace/kanban-tab'
import type { WorkspaceMember } from '@/components/features/tasks/task-workspace'
import { COLUMNS, TASKS } from './uppgifter-mock-data'
import { MEMBERS } from './hero-shot-data'

const WORKSPACE_MEMBERS: WorkspaceMember[] = MEMBERS.map((m) => ({
  id: m.id,
  name: m.name,
  email: m.email,
  avatarUrl: m.avatarUrl,
}))

export function UppgifterReal() {
  return (
    <div className="pointer-events-none select-none space-y-6 bg-background px-10 py-9 text-left">
      <PageHeader
        title="Uppgifter"
        subtitle="Planera och följ upp åtgärder — kopplade direkt till regelverken de uppfyller."
        primaryAction={
          <Button>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Ny uppgift
          </Button>
        }
      />
      <KanbanTab
        filteredTasks={TASKS}
        initialColumns={COLUMNS}
        activeStatusFilter={[]}
        workspaceMembers={WORKSPACE_MEMBERS}
      />
    </div>
  )
}
