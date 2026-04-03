'use client'

/**
 * Story 14.15b, Task 3: Compliance status change write preview card.
 * Shows old → new status, editable reason, confirm/cancel.
 */

import { useState } from 'react'
import { Check, Loader2, X, ArrowRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateListItem } from '@/app/actions/document-list'
import { useChatDetail } from '@/lib/ai/chat-detail-context'
import type { WriteToolResponse } from '@/lib/agent/tools/types'
import type { ComplianceStatus } from '@prisma/client'

const COMPLIANCE_OPTIONS: { value: ComplianceStatus; label: string }[] = [
  { value: 'EJ_PABORJAD', label: 'Ej påbörjad' },
  { value: 'PAGAENDE', label: 'Pågående' },
  { value: 'UPPFYLLD', label: 'Uppfylld' },
  { value: 'EJ_UPPFYLLD', label: 'Ej uppfylld' },
  { value: 'EJ_TILLAMPLIG', label: 'Ej tillämplig' },
]

const STATUS_VARIANT: Record<
  ComplianceStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  EJ_PABORJAD: 'outline',
  PAGAENDE: 'default',
  UPPFYLLD: 'default',
  EJ_UPPFYLLD: 'destructive',
  EJ_TILLAMPLIG: 'secondary',
}

function getStatusLabel(status: ComplianceStatus): string {
  return COMPLIANCE_OPTIONS.find((o) => o.value === status)?.label ?? status
}

interface WritePreviewStatusProps {
  data: WriteToolResponse<unknown>
}

export function WritePreviewStatus({ data }: WritePreviewStatusProps) {
  const { closeDetail, addSystemMessage } = useChatDetail()
  const params = data.params ?? {}

  const listItemId = (params.listItemId as string) ?? ''
  const lawTitle =
    (params.lawTitle as string) ?? (params.documentTitle as string) ?? ''
  const oldStatus = params.oldStatus as ComplianceStatus | undefined
  const [newStatus, setNewStatus] = useState<ComplianceStatus>(
    (params.complianceStatus as ComplianceStatus) ??
      (params.newStatus as ComplianceStatus) ??
      'PAGAENDE'
  )
  const [reason, setReason] = useState((params.reason as string) ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await updateListItem({
        listItemId,
        complianceStatus: newStatus,
      })
      if (result.success) {
        setSuccess(true)
        addSystemMessage(`Status uppdaterad: ${getStatusLabel(newStatus)}`)
      } else {
        setError(result.error ?? 'Kunde inte uppdatera status')
      }
    } catch {
      setError('Ett oväntat fel uppstod')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    addSystemMessage('Användaren avbröt åtgärden.')
    closeDetail()
  }

  // Success state
  if (success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">Status uppdaterad</span>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          {lawTitle && <p className="text-sm font-medium">{lawTitle}</p>}
          <div className="flex items-center gap-2">
            {oldStatus && (
              <>
                <Badge variant={STATUS_VARIANT[oldStatus]}>
                  {getStatusLabel(oldStatus)}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </>
            )}
            <Badge variant={STATUS_VARIANT[newStatus]}>
              {getStatusLabel(newStatus)}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <a href="/app/laglista">
            Visa i laglistan
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>
    )
  }

  // Edit form
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{data.preview}</p>

      {lawTitle && <p className="text-sm font-medium">{lawTitle}</p>}

      {/* Status change visualization */}
      <div className="space-y-3">
        {oldStatus && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Nuvarande:</span>
            <Badge variant={STATUS_VARIANT[oldStatus]}>
              {getStatusLabel(oldStatus)}
            </Badge>
          </div>
        )}

        <div>
          <span className="text-xs text-muted-foreground mb-1 block">
            Ny status
          </span>
          <Select
            value={newStatus}
            onValueChange={(v) => setNewStatus(v as ComplianceStatus)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPLIANCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <span className="text-xs text-muted-foreground mb-1 block">
            Anledning (valfritt)
          </span>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="text-sm min-h-[60px] resize-none"
            placeholder="Beskriv varför statusen ändras..."
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleConfirm} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Bekräfta
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={saving}
        >
          <X className="h-4 w-4 mr-1" />
          Avbryt
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
