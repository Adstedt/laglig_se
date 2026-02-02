import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { WorkspaceStatusActions } from '@/components/admin/workspace-status-actions'
import { WorkspaceTierForm } from '@/components/admin/workspace-tier-form'
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
import {
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_VARIANT,
  TIER_LABELS,
} from '@/lib/admin/constants'
import { getWorkspaceDetail } from '@/lib/admin/queries'
import type { WorkspaceRole } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const workspace = await getWorkspaceDetail(id)

  if (!workspace) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/workspaces"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Link>
        <h1 className="text-2xl font-bold">{workspace.name}</h1>
        <Badge variant={STATUS_VARIANT[workspace.status]}>
          {STATUS_LABELS[workspace.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Workspace Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Arbetsyta</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <InfoRow label="Namn" value={workspace.name} />
              <InfoRow label="Slug" value={workspace.slug} />
              <InfoRow label="Org.nummer" value={workspace.org_number ?? '—'} />
              <InfoRow
                label="Nivå"
                value={TIER_LABELS[workspace.subscription_tier]}
              />
              <InfoRow label="Status" value={STATUS_LABELS[workspace.status]} />
              <InfoRow
                label="Skapad"
                value={format(workspace.created_at, 'yyyy-MM-dd HH:mm', {
                  locale: sv,
                })}
              />
              {workspace.paused_at && (
                <InfoRow
                  label="Pausad"
                  value={format(workspace.paused_at, 'yyyy-MM-dd HH:mm', {
                    locale: sv,
                  })}
                />
              )}
              {workspace.deleted_at && (
                <InfoRow
                  label="Borttagen"
                  value={format(workspace.deleted_at, 'yyyy-MM-dd HH:mm', {
                    locale: sv,
                  })}
                />
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Company Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Företagsprofil</CardTitle>
          </CardHeader>
          <CardContent>
            {workspace.company_profile ? (
              <dl className="space-y-3 text-sm">
                <InfoRow
                  label="Företagsnamn"
                  value={workspace.company_profile.company_name}
                />
                <InfoRow
                  label="SNI-kod"
                  value={workspace.company_profile.sni_code ?? '—'}
                />
                <InfoRow
                  label="Bolagsform"
                  value={workspace.company_profile.legal_form ?? '—'}
                />
                <InfoRow
                  label="Antal anställda"
                  value={
                    workspace.company_profile.employee_count?.toString() ?? '—'
                  }
                />
                <InfoRow
                  label="Adress"
                  value={workspace.company_profile.address ?? '—'}
                />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ingen företagsprofil
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {workspace._count.law_lists}
            </div>
            <p className="text-sm text-muted-foreground">Laglistor</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{workspace._count.tasks}</div>
            <p className="text-sm text-muted-foreground">Uppgifter</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{workspace._count.files}</div>
            <p className="text-sm text-muted-foreground">Dokument</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ändra prenumerationsnivå</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkspaceTierForm
              workspaceId={workspace.id}
              currentTier={workspace.subscription_tier}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Statusåtgärder</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkspaceStatusActions
              workspaceId={workspace.id}
              currentStatus={workspace.status}
            />
          </CardContent>
        </Card>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Medlemmar ({workspace.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead>Gick med</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.user.name ?? '—'}
                  </TableCell>
                  <TableCell>{member.user.email}</TableCell>
                  <TableCell>
                    {ROLE_LABELS[member.role as WorkspaceRole] ?? member.role}
                  </TableCell>
                  <TableCell>
                    {format(member.joined_at, 'yyyy-MM-dd', { locale: sv })}
                  </TableCell>
                </TableRow>
              ))}
              {workspace.members.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    Inga medlemmar
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
