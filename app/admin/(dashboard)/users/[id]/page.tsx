import { format, formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_VARIANT,
  TIER_LABELS,
} from '@/lib/admin/constants'
import { getUserDetail } from '@/lib/admin/queries'
import type {
  WorkspaceRole,
  WorkspaceStatus,
  SubscriptionTier,
} from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getUserDetail(id)

  if (!user) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Link>
        <h1 className="text-2xl font-bold">{user.name ?? user.email}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Användarinformation</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <InfoRow label="Namn" value={user.name ?? '—'} />
              <InfoRow label="E-post" value={user.email} />
              <InfoRow label="Avatar" value={user.avatar_url ?? '—'} />
              <InfoRow
                label="Skapad"
                value={format(user.created_at, 'yyyy-MM-dd HH:mm', {
                  locale: sv,
                })}
              />
              <InfoRow
                label="Senaste inloggning"
                value={
                  user.last_login_at
                    ? formatDistanceToNow(user.last_login_at, {
                        addSuffix: true,
                        locale: sv,
                      })
                    : 'Aldrig'
                }
              />
            </dl>
          </CardContent>
        </Card>

        {/* Impersonate Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Åtgärder</CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button variant="outline" disabled>
                      Logga in som användare
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Kommer i nästa story</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>

      {/* Workspace Memberships */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Workspace-medlemskap ({user.workspace_members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arbetsyta</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead>Nivå</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gick med</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.workspace_members.map((membership) => (
                <TableRow key={membership.workspace.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/workspaces/${membership.workspace.id}`}
                      className="hover:underline"
                    >
                      {membership.workspace.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {ROLE_LABELS[membership.role as WorkspaceRole] ??
                      membership.role}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {
                        TIER_LABELS[
                          membership.workspace
                            .subscription_tier as SubscriptionTier
                        ]
                      }
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        STATUS_VARIANT[
                          membership.workspace.status as WorkspaceStatus
                        ]
                      }
                    >
                      {
                        STATUS_LABELS[
                          membership.workspace.status as WorkspaceStatus
                        ]
                      }
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(membership.joined_at, 'yyyy-MM-dd', {
                      locale: sv,
                    })}
                  </TableCell>
                </TableRow>
              ))}
              {user.workspace_members.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    Inga workspace-medlemskap
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
