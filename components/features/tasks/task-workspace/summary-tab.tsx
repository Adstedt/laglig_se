'use client'

/**
 * Story 6.4: Task Summary Dashboard Tab
 * Overview metrics, charts, and recent activity
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ListTodo,
  TrendingUp,
  Calendar,
} from 'lucide-react'
import type { TaskSummaryStats } from '@/app/actions/tasks'

// ============================================================================
// Props
// ============================================================================

interface SummaryTabProps {
  initialStats: TaskSummaryStats
}

// ============================================================================
// Main Component
// ============================================================================

export function SummaryTab({ initialStats }: SummaryTabProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const completionRate =
    initialStats.total > 0
      ? Math.round((initialStats.byStatus.done / initialStats.total) * 100)
      : 0

  // Navigate to list tab with filter
  const navigateWithFilter = (filter: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'lista')
    params.set(filter, value)
    router.push(`/tasks?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Totalt antal uppgifter
            </CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{initialStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {initialStats.byStatus.open} att göra,{' '}
              {initialStats.byStatus.inProgress} pågående
            </p>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Klara</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {initialStats.byStatus.done}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {completionRate}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Försenade</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {initialStats.overdue}
            </div>
            <p className="text-xs text-muted-foreground">
              Kräver omedelbar åtgärd
            </p>
          </CardContent>
        </Card>

        {/* Due This Week */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denna vecka</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{initialStats.dueThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              Förfaller inom 7 dagar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Second Row - Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statusfördelning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <StatusBar
                label="Att göra"
                count={initialStats.byStatus.open}
                total={initialStats.total}
                color="bg-gray-400"
              />
              <StatusBar
                label="Pågående"
                count={initialStats.byStatus.inProgress}
                total={initialStats.total}
                color="bg-blue-500"
              />
              <StatusBar
                label="Klar"
                count={initialStats.byStatus.done}
                total={initialStats.total}
                color="bg-green-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prioritetsfördelning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <StatusBar
                label="Kritisk"
                count={initialStats.byPriority.CRITICAL}
                total={initialStats.total}
                color="bg-red-500"
              />
              <StatusBar
                label="Hög"
                count={initialStats.byPriority.HIGH}
                total={initialStats.total}
                color="bg-orange-500"
              />
              <StatusBar
                label="Medium"
                count={initialStats.byPriority.MEDIUM}
                total={initialStats.total}
                color="bg-blue-500"
              />
              <StatusBar
                label="Låg"
                count={initialStats.byPriority.LOW}
                total={initialStats.total}
                color="bg-gray-400"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Snabbåtgärder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <QuickActionButton
              icon={<AlertCircle className="h-4 w-4" />}
              label="Visa försenade"
              count={initialStats.overdue}
              variant="destructive"
              onClick={() => navigateWithFilter('overdue', 'true')}
            />
            <QuickActionButton
              icon={<Clock className="h-4 w-4" />}
              label="Visa pågående"
              count={initialStats.byStatus.inProgress}
              variant="default"
              onClick={() => navigateWithFilter('status', 'in_progress')}
            />
            <QuickActionButton
              icon={<Calendar className="h-4 w-4" />}
              label="Denna vecka"
              count={initialStats.dueThisWeek}
              variant="outline"
              onClick={() => navigateWithFilter('dueWeek', 'true')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// Helper Components
// ============================================================================

function StatusBar({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function QuickActionButton({
  icon,
  label,
  count,
  variant,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count: number
  variant: 'default' | 'destructive' | 'outline'
  onClick: () => void
}) {
  const baseClasses =
    'inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer'

  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive:
      'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline:
      'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  }

  if (count === 0) return null

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {icon}
      {label}
      <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-xs">
        {count}
      </span>
    </button>
  )
}
