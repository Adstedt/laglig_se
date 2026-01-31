'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Mail } from 'lucide-react'
import type { WorkspaceRole } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { acceptInvitation, declineInvitation } from '@/app/actions/invitations'
import type { InvitationWithDetails } from '@/app/actions/invitations'
import { getSafeRedirectUrl } from '@/lib/utils'

// ============================================================================
// Constants
// ============================================================================

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: 'Ägare',
  ADMIN: 'Administratör',
  HR_MANAGER: 'HR-ansvarig',
  MEMBER: 'Medlem',
  AUDITOR: 'Revisor',
}

// ============================================================================
// Component
// ============================================================================

interface PendingInvitationsProps {
  invitations: InvitationWithDetails[]
  onAllDeclined: () => void
  redirectUrl?: string | undefined
}

export function PendingInvitations({
  invitations: initialInvitations,
  onAllDeclined,
  redirectUrl,
}: PendingInvitationsProps) {
  const router = useRouter()
  const [invitations, setInvitations] =
    useState<InvitationWithDetails[]>(initialInvitations)
  const [loadingAccept, setLoadingAccept] = useState<string | null>(null)
  const [loadingDecline, setLoadingDecline] = useState<string | null>(null)

  const handleAccept = async (invitationId: string) => {
    setLoadingAccept(invitationId)
    try {
      const result = await acceptInvitation(invitationId)
      if (result.success) {
        toast.success('Inbjudan accepterad!')
        const targetUrl = getSafeRedirectUrl(redirectUrl)
        router.push(targetUrl)
      } else {
        toast.error(result.error ?? 'Något gick fel')
      }
    } catch {
      toast.error('Något gick fel. Försök igen.')
    } finally {
      setLoadingAccept(null)
    }
  }

  const handleDecline = async (invitationId: string) => {
    setLoadingDecline(invitationId)
    try {
      const result = await declineInvitation(invitationId)
      if (result.success) {
        const remaining = invitations.filter((inv) => inv.id !== invitationId)
        setInvitations(remaining)
        if (remaining.length === 0) {
          onAllDeclined()
        }
      } else {
        toast.error(result.error ?? 'Något gick fel')
      }
    } catch {
      toast.error('Något gick fel. Försök igen.')
    } finally {
      setLoadingDecline(null)
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const isLoading = loadingAccept !== null || loadingDecline !== null

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Väntande inbjudningar</h2>
        <p className="text-sm text-muted-foreground">
          Du har blivit inbjuden till{' '}
          {invitations.length === 1 ? 'ett' : invitations.length} workspace
        </p>
      </div>

      {invitations.map((invitation) => (
        <Card key={invitation.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {invitation.workspace.name}
            </CardTitle>
            <CardDescription className="space-y-1">
              <span className="block">
                Roll: {ROLE_LABELS[invitation.role]}
              </span>
              <span className="block">
                Inbjuden av:{' '}
                {invitation.inviter.name ?? invitation.inviter.email}
              </span>
              <span className="block">
                Gäller till: {formatDate(invitation.expires_at)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              onClick={() => handleAccept(invitation.id)}
              disabled={isLoading}
              className="flex-1"
            >
              {loadingAccept === invitation.id ? 'Accepterar...' : 'Acceptera'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDecline(invitation.id)}
              disabled={isLoading}
              className="flex-1"
            >
              {loadingDecline === invitation.id ? 'Avböjer...' : 'Avböj'}
            </Button>
          </CardContent>
        </Card>
      ))}

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onAllDeclined}
          disabled={isLoading}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors disabled:opacity-50"
        >
          Skapa eget workspace istället
        </button>
      </div>
    </div>
  )
}
