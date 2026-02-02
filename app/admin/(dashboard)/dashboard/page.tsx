import { format, formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MetricCard } from '@/components/admin/metric-card'
import {
  getWorkspaceMetrics,
  getUserMetrics,
  getRecentWorkspaces,
  getRecentUsers,
} from '@/lib/admin/queries'
import type { SubscriptionTier, WorkspaceStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<WorkspaceStatus, string> = {
  ACTIVE: 'Aktiv',
  PAUSED: 'Pausad',
  DELETED: 'Borttagen',
}

const STATUS_VARIANT: Record<
  WorkspaceStatus,
  'default' | 'secondary' | 'destructive'
> = {
  ACTIVE: 'default',
  PAUSED: 'secondary',
  DELETED: 'destructive',
}

const TIER_LABELS: Record<SubscriptionTier, string> = {
  TRIAL: 'Trial',
  SOLO: 'Solo',
  TEAM: 'Team',
  ENTERPRISE: 'Enterprise',
}

export default async function AdminDashboardPage() {
  const [workspaceMetrics, userMetrics, recentWorkspaces, recentUsers] =
    await Promise.all([
      getWorkspaceMetrics(),
      getUserMetrics(),
      getRecentWorkspaces(10),
      getRecentUsers(10),
    ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Totalt arbetsytor" value={workspaceMetrics.total}>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Aktiva</span>
              <span className="font-medium text-foreground">
                {workspaceMetrics.active}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Pausade</span>
              <span className="font-medium text-foreground">
                {workspaceMetrics.paused}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Borttagna</span>
              <span className="font-medium text-foreground">
                {workspaceMetrics.deleted}
              </span>
            </div>
          </div>
        </MetricCard>

        <MetricCard title="Totalt användare" value={userMetrics.total}>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Senaste 7 dagarna</span>
              <span className="font-medium text-foreground">
                {userMetrics.newLast7Days}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Senaste 30 dagarna</span>
              <span className="font-medium text-foreground">
                {userMetrics.newLast30Days}
              </span>
            </div>
          </div>
        </MetricCard>

        <MetricCard
          title="Prenumerationer"
          value={workspaceMetrics.total}
          description="Fördelning per nivå"
        >
          <div className="space-y-1 text-xs text-muted-foreground">
            {(
              Object.entries(workspaceMetrics.byTier) as [
                SubscriptionTier,
                number,
              ][]
            ).map(([tier, count]) => (
              <div key={tier} className="flex justify-between">
                <span>{TIER_LABELS[tier]}</span>
                <span className="font-medium text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </MetricCard>

        <MetricCard
          title="Nya registreringar"
          value={userMetrics.newLast7Days}
          description="Senaste 7 dagarna"
        >
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>30 dagar</span>
              <span className="font-medium text-foreground">
                {userMetrics.newLast30Days}
              </span>
            </div>
          </div>
        </MetricCard>
      </div>

      {/* Recent Workspaces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Senaste arbetsytor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead>Ägare</TableHead>
                <TableHead>Nivå</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Medlemmar</TableHead>
                <TableHead>Skapad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentWorkspaces.map((ws) => (
                <TableRow key={ws.id}>
                  <TableCell className="font-medium">{ws.name}</TableCell>
                  <TableCell>{ws.owner.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TIER_LABELS[ws.subscription_tier]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[ws.status]}>
                      {STATUS_LABELS[ws.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{ws._count.members}</TableCell>
                  <TableCell>
                    {format(ws.created_at, 'yyyy-MM-dd', { locale: sv })}
                  </TableCell>
                </TableRow>
              ))}
              {recentWorkspaces.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    Inga arbetsytor ännu
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Senaste användare</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Senaste inloggning</TableHead>
                <TableHead>Arbetsytor</TableHead>
                <TableHead>Registrerad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name ?? '—'}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.last_login_at
                      ? formatDistanceToNow(user.last_login_at, {
                          addSuffix: true,
                          locale: sv,
                        })
                      : '—'}
                  </TableCell>
                  <TableCell>{user._count.workspace_members}</TableCell>
                  <TableCell>
                    {format(user.created_at, 'yyyy-MM-dd', { locale: sv })}
                  </TableCell>
                </TableRow>
              ))}
              {recentUsers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    Inga användare ännu
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
