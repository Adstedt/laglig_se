'use client'

/**
 * Story 5.7: Team Settings Tab
 * Members list, invite, role management.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Users, UserPlus, Loader2, MoreHorizontal, Trash2 } from 'lucide-react'
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
import type { MemberData } from './settings-tabs'
import type { WorkspaceRole } from '@prisma/client'

// ============================================================================
// Constants
// ============================================================================

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: 'Ägare',
  ADMIN: 'Administratör',
  HR_MANAGER: 'HR-ansvarig',
  MEMBER: 'Medlem',
  AUDITOR: 'Granskare',
}

const ROLE_COLORS: Record<WorkspaceRole, string> = {
  OWNER:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  HR_MANAGER:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  MEMBER:
    'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300',
  AUDITOR:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
}

const ASSIGNABLE_ROLES: WorkspaceRole[] = [
  'ADMIN',
  'HR_MANAGER',
  'MEMBER',
  'AUDITOR',
]

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

// ============================================================================
// Component
// ============================================================================

interface TeamTabProps {
  members: MemberData[]
}

export function TeamTab({ members }: TeamTabProps) {
  const [isPending, startTransition] = useTransition()
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Team</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hantera teammedlemmar och roller.
              </p>
            </div>
          </div>

          {/* Invite Button */}
          <Can permission="members:invite">
            <Button disabled>
              <UserPlus className="mr-2 h-4 w-4" />
              Bjud in medlem
            </Button>
          </Can>
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Medlem</TableHead>
              <TableHead>Roll</TableHead>
              <TableHead>Gick med</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                {/* Member Info */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={member.user.avatar_url || undefined}
                        alt={member.user.name || member.user.email}
                      />
                      <AvatarFallback className={ROLE_COLORS[member.role]}>
                        {getInitials(member.user.name, member.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {member.user.name || member.user.email}
                      </p>
                      {member.user.name && (
                        <p className="text-sm text-muted-foreground">
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
    </div>
  )
}
