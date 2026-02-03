'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { startImpersonation } from '@/app/actions/admin-impersonate'

interface ImpersonateButtonProps {
  userId: string
  userName: string
  userEmail: string
}

export function ImpersonateButton({
  userId,
  userName,
  userEmail,
}: ImpersonateButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const result = await startImpersonation(userId)
      if (result.success) {
        window.location.href = '/dashboard'
      } else {
        setError(result.error ?? 'Unknown error')
        setLoading(false)
      }
    } catch {
      setError('Ett oväntat fel inträffade')
      setLoading(false)
    }
  }

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline">Logga in som {userName}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekräfta inloggning</AlertDialogTitle>
            <AlertDialogDescription>
              Du kommer att logga in som {userName} ({userEmail}). Din
              admin-session behålls.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={loading}>
              {loading ? 'Loggar in...' : `Logga in som ${userName}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
