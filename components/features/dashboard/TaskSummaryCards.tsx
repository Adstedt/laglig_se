import { AlertCircle, Calendar, User } from 'lucide-react'
import { TaskSummaryCard } from './TaskSummaryCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TaskCounts {
  overdue: number
  thisWeek: number
  myTasks: number
}

interface TaskSummaryCardsProps {
  counts: TaskCounts | null
}

export function TaskSummaryCards({ counts }: TaskSummaryCardsProps) {
  // Show placeholder if Task model not yet implemented
  if (counts === null) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="opacity-60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Uppgifter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Kommer snart</p>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      <TaskSummaryCard
        title="Förfallna uppgifter"
        count={counts.overdue}
        icon={AlertCircle}
        accentColor="#EF4444"
        href="/kanban?filter=overdue"
        description={
          counts.overdue > 0 ? 'Kräver uppmärksamhet' : 'Inga förfallna'
        }
      />
      <TaskSummaryCard
        title="Uppgifter denna vecka"
        count={counts.thisWeek}
        icon={Calendar}
        accentColor="#3B82F6"
        href="/kanban?filter=this-week"
        description="Att slutföra"
      />
      <TaskSummaryCard
        title="Mina tilldelade uppgifter"
        count={counts.myTasks}
        icon={User}
        accentColor="#8B5CF6"
        href="/kanban?filter=my-tasks"
        description="Tilldelade till dig"
      />
    </div>
  )
}
