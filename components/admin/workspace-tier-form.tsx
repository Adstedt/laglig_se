'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { updateWorkspaceTier } from '@/app/actions/admin-workspaces'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TIER_LABELS } from '@/lib/admin/constants'
import type { SubscriptionTier } from '@prisma/client'

interface WorkspaceTierFormProps {
  workspaceId: string
  currentTier: SubscriptionTier
}

const TIERS: SubscriptionTier[] = ['TRIAL', 'SOLO', 'TEAM', 'ENTERPRISE']

export function WorkspaceTierForm({
  workspaceId,
  currentTier,
}: WorkspaceTierFormProps) {
  const router = useRouter()
  const [selectedTier, setSelectedTier] =
    useState<SubscriptionTier>(currentTier)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const hasChanged = selectedTier !== currentTier

  function handleSave() {
    if (!hasChanged) return
    setShowConfirm(true)
  }

  function handleConfirm() {
    setShowConfirm(false)
    setMessage(null)

    startTransition(async () => {
      const result = await updateWorkspaceTier(workspaceId, selectedTier)
      if (result.success) {
        setMessage({ type: 'success', text: 'Nivå uppdaterad' })
        router.refresh()
      } else {
        setMessage({
          type: 'error',
          text: result.error ?? 'Ett oväntat fel uppstod',
        })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select
          value={selectedTier}
          onValueChange={(value) => setSelectedTier(value as SubscriptionTier)}
          disabled={isPending}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIERS.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {TIER_LABELS[tier]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleSave}
          disabled={!hasChanged || isPending}
          size="sm"
        >
          {isPending ? 'Sparar...' : 'Spara'}
        </Button>
      </div>

      {message && (
        <p
          className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-destructive'}`}
        >
          {message.text}
        </p>
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekräfta ändring</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ändra prenumerationsnivån från{' '}
              <strong>{TIER_LABELS[currentTier]}</strong> till{' '}
              <strong>{TIER_LABELS[selectedTier]}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Bekräfta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
