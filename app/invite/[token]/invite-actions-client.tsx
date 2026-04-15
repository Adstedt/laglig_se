'use client'

/**
 * Story 5.3: Accept/Decline client actions for the /invite/[token] page.
 * Consumes the existing server actions from app/actions/invitations.ts.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { acceptInvitation, declineInvitation } from '@/app/actions/invitations'

interface InviteActionsClientProps {
  invitationId: string
  workspaceSlug: string
}

export function InviteActionsClient({
  invitationId,
  workspaceSlug: _workspaceSlug,
}: InviteActionsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<'accept' | 'decline' | null>(null)

  const handleAccept = () => {
    setAction('accept')
    startTransition(async () => {
      const result = await acceptInvitation(invitationId)
      if (result.success) {
        toast.success('Du har gått med i arbetsplatsen')
        // acceptInvitation already calls setActiveWorkspace on the server
        // so the dashboard will route to the right workspace via the cookie.
        router.push('/dashboard')
      } else {
        toast.error(result.error ?? 'Kunde inte acceptera inbjudan')
        setAction(null)
      }
    })
  }

  const handleDecline = () => {
    setAction('decline')
    startTransition(async () => {
      const result = await declineInvitation(invitationId)
      if (result.success) {
        toast.success('Inbjudan avböjd')
        router.push('/')
      } else {
        toast.error(result.error ?? 'Kunde inte avböja inbjudan')
        setAction(null)
      }
    })
  }

  return (
    <div className="mt-6 flex flex-col gap-2">
      <Button
        onClick={handleAccept}
        disabled={isPending}
        className="w-full"
        size="lg"
      >
        {isPending && action === 'accept' && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Acceptera inbjudan
      </Button>
      <Button
        onClick={handleDecline}
        disabled={isPending}
        variant="outline"
        className="w-full"
      >
        {isPending && action === 'decline' && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Avböj
      </Button>
    </div>
  )
}
