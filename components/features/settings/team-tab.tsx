'use client'

/**
 * Story 5.7: Team Settings Tab
 * Members list, invite, role management.
 *
 * Story 5.3: Invite modal, pending-invitations section with revoke/resend.
 */

import { useState, useTransition } from 'react'
import useSWR from 'swr'
import { formatDistanceToNow } from 'date-fns'
import { sv } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Users,
  UserPlus,
  Loader2,
  MoreHorizontal,
  Trash2,
  MailCheck,
  RefreshCw,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Can } from '@/components/permissions/can'
import {
  changeMemberRole,
  removeMember,
} from '@/app/actions/workspace-settings'
import { getSeatUsage } from '@/app/actions/seats'
import type { MemberData } from './settings-tabs'
import type { WorkspaceRole, InvitationStatus } from '@prisma/client'
import { ROLE_LABELS, ROLE_COLORS, ASSIGNABLE_ROLES } from './role-labels'
import { InviteMemberModal } from './invite-member-modal'

// ============================================================================
// Types
// ============================================================================

interface PendingInvitation {
  id: string
  email: string
  role: WorkspaceRole
  status: InvitationStatus
  expires_at: string
  created_at: string
}

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

async function fetchInvitations(): Promise<{
  invitations: PendingInvitation[]
}> {
  const res = await fetch('/api/workspace/invitations')
  if (!res.ok) {
    throw new Error('Kunde inte hämta inbjudningar')
  }
  return res.json()
}

// ============================================================================
// Component
// ============================================================================

interface TeamTabProps {
  members: MemberData[]
}

const INVITATIONS_SWR_KEY = 'workspace-invitations'
const SEAT_USAGE_SWR_KEY = 'workspace-seat-usage'

export function TeamTab({ members }: TeamTabProps) {
  const [isPending, startTransition] = useTransition()
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invitationActionId, setInvitationActionId] = useState<string | null>(
    null
  )

  const { data, mutate } = useSWR(INVITATIONS_SWR_KEY, fetchInvitations, {
    revalidateOnFocus: false,
  })
  const invitations = data?.invitations ?? []

  // Story 5.5a: seat usage subtitle + invite-modal gate.
  const { data: seatUsage, mutate: mutateSeatUsage } = useSWR(
    SEAT_USAGE_SWR_KEY,
    () => getSeatUsage(),
    { revalidateOnFocus: false }
  )

  const handleRoleChange = (memberId: string, newRole: string) => {
    setPendingMemberId(memberId)
    startTransition(async () => {
      try {
        const result = await changeMemberRole(memberId, newRole)
        if (result.success) {
          toast.success(result.message || 'Roll uppdaterad')
        } else {
          toast.error(result.error || 'Något gick fel')
        }
      } finally {
        setPendingMemberId(null)
      }
    })
  }

  const handleRemoveMember = (memberId: string) => {
    setRemovingMemberId(memberId)
    startTransition(async () => {
      try {
        const result = await removeMember(memberId)
        if (result.success) {
          toast.success(result.message || 'Medlem borttagen')
        } else {
          toast.error(result.error || 'Något gick fel')
        }
      } finally {
        setRemovingMemberId(null)
      }
    })
  }

  const handleRevokeInvitation = async (id: string) => {
    setInvitationActionId(id)
    try {
      const res = await fetch(`/api/workspace/invitations/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error || 'Kunde inte återkalla inbjudan')
        return
      }
      toast.success('Inbjudan återkallad')
      await mutate()
    } catch {
      toast.error('Nätverksfel. Försök igen.')
    } finally {
      setInvitationActionId(null)
    }
  }

  const handleResendInvitation = async (id: string) => {
    setInvitationActionId(id)
    try {
      const res = await fetch(`/api/workspace/invitations/${id}/resend`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error || 'Kunde inte skicka om inbjudan')
        return
      }
      toast.success('Inbjudan skickad igen')
      await mutate()
    } catch {
      toast.error('Nätverksfel. Försök igen.')
    } finally {
      setInvitationActionId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">Team</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {seatUsage
                  ? seatUsage.limit === null
                    ? 'Hantera teammedlemmar och roller.'
                    : seatUsage.used >= seatUsage.limit
                      ? `Alla ${seatUsage.limit} platser används — uppgradera för fler.`
                      : `${seatUsage.used} av ${seatUsage.limit} platser används.`
                  : 'Hantera teammedlemmar och roller.'}
              </p>
            </div>
          </div>

          {/* Invite Button */}
          <Can permission="members:invite">
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Bjud in medlem
            </Button>
          </Can>
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px] text-xs">Medlem</TableHead>
              <TableHead className="text-xs">Roll</TableHead>
              <TableHead className="text-xs">Gick med</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                {/* Member Info */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={member.user.avatar_url || undefined}
                        alt={member.user.name || member.user.email}
                      />
                      <AvatarFallback
                        className={`text-xs ${ROLE_COLORS[member.role]}`}
                      >
                        {getInitials(member.user.name, member.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {member.user.name || member.user.email}
                      </p>
                      {member.user.name && (
                        <p className="text-xs text-muted-foreground">
                          {member.user.email}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Role */}
                <TableCell>
                  {member.role === 'OWNER' ? (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_COLORS[member.role]}`}
                    >
                      {ROLE_LABELS[member.role]}
                    </span>
                  ) : (
                    <Can
                      permission="members:change_role"
                      fallback={
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_COLORS[member.role]}`}
                        >
                          {ROLE_LABELS[member.role]}
                        </span>
                      }
                    >
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          handleRoleChange(member.id, value)
                        }
                        disabled={isPending && pendingMemberId === member.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue>
                            {isPending && pendingMemberId === member.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              ROLE_LABELS[member.role]
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Can>
                  )}
                </TableCell>

                {/* Joined Date */}
                <TableCell className="text-muted-foreground">
                  {formatDate(member.joined_at)}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  {member.role !== 'OWNER' && (
                    <Can permission="members:remove">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Öppna meny</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Ta bort medlem
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Ta bort medlem?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Är du säker på att du vill ta bort{' '}
                                  <span className="font-medium">
                                    {member.user.name || member.user.email}
                                  </span>{' '}
                                  från arbetsplatsen? Denna åtgärd kan inte
                                  ångras.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  disabled={removingMemberId === member.id}
                                >
                                  {removingMemberId === member.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  Ta bort
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Can>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              Inga medlemmar i arbetsplatsen
            </p>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      <Can permission="members:invite">
        {invitations.length > 0 && (
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <MailCheck className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Väntande inbjudningar</h3>
                <span className="text-xs text-muted-foreground">
                  ({invitations.length})
                </span>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">E-post</TableHead>
                  <TableHead className="text-xs">Roll</TableHead>
                  <TableHead className="text-xs">Skickat</TableHead>
                  <TableHead className="text-xs">Upphör</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => {
                  const expiresAt = new Date(inv.expires_at)
                  const isExpiredSoon =
                    expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{inv.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_COLORS[inv.role]}`}
                        >
                          {ROLE_LABELS[inv.role]}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(new Date(inv.created_at))}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs ${isExpiredSoon ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
                        >
                          {formatDistanceToNow(expiresAt, {
                            addSuffix: true,
                            locale: sv,
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={invitationActionId === inv.id}
                            >
                              {invitationActionId === inv.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                              <span className="sr-only">Öppna meny</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => handleResendInvitation(inv.id)}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Skicka igen
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => handleRevokeInvitation(inv.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Återkalla
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Can>

      <InviteMemberModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        seatUsage={seatUsage ?? null}
        onInvited={() => {
          void mutate()
          void mutateSeatUsage()
        }}
      />
    </div>
  )
}
