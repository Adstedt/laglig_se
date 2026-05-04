import type { TaskWithRelations } from '@/app/actions/tasks'

export function isTaskOverdue(task: TaskWithRelations): boolean {
  if (!task.due_date || task.column.is_done) return false
  return new Date(task.due_date) < new Date()
}
