'use client'

/**
 * Story 5.3: Invite member dialog.
 * Posts to /api/workspace/invitations and calls onInvited() on success
 * so the parent can refresh the pending-invitations list.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { WorkspaceRole } from '@prisma/client'
import { ROLE_LABELS, ASSIGNABLE_ROLES } from './role-labels'
import type { SeatUsage } from '@/lib/usage/seats'

interface InviteMemberModalProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onInvited: () => void
  /** Story 5.5a: seat-usage data to render the X/N counter + upgrade CTA. */
  seatUsage: SeatUsage | null
}

const DEFAULT_ROLE: WorkspaceRole = 'MEMBER'

// Simple client-side email sanity check. Server-side Zod is authoritative.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InviteMemberModal({
  open,
  onOpenChange,
  onInvited,
  seatUsage,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>(DEFAULT_ROLE)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Story 5.5a: when at the seat cap, replace the submit button with an
  // upgrade CTA. Enterprise (limit === null) is unlimited so this never fires.
  const atCap =
    seatUsage !== null &&
    seatUsage.limit !== null &&
    seatUsage.used >= seatUsage.limit

  const resetForm = () => {
    setEmail('')
    setRole(DEFAULT_ROLE)
    setError(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmed = email.trim()
    if (!trimmed) {
      setError('E-postadress krävs')
      return
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError('Ogiltig e-postadress')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/workspace/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, role }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(
          typeof data?.error === 'string'
            ? data.error
            : 'Kunde inte skicka inbjudan'
        )
        return
      }

      toast.success(`Inbjudan skickad till ${trimmed}`)
      onInvited()
      resetForm()
      onOpenChange(false)
    } catch {
      setError('Nätverksfel. Försök igen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Bjud in medlem</DialogTitle>
            <DialogDescription>
              Skicka en inbjudan via e-post. Inbjudan gäller i 7 dagar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">E-postadress</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                placeholder="namn@foretag.se"
                disabled={isSubmitting || atCap}
                required
              />
              {seatUsage && seatUsage.limit !== null && (
                <p className="text-xs text-muted-foreground">
                  {seatUsage.used} / {seatUsage.limit} platser används
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invite-role">Roll</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as WorkspaceRole)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Avbryt
            </Button>
            {atCap ? (
              <Button asChild type="button">
                <Link href="/settings?tab=billing">
                  Uppgradera plan
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting || !email.trim()}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Skicka inbjudan
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
