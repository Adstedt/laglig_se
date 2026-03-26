'use client'

/**
 * Story 14.15b, Task 8: Law list item detail view in sidebar.
 * Shows compliance status (editable), group, context notes, navigation.
 */

import { useState } from 'react'
import { ExternalLink, Loader2, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateListItem } from '@/app/actions/document-list'
import {
  useChatDetail,
  type LawListItemDetailData,
} from '@/lib/ai/chat-detail-context'
import type { ComplianceStatus } from '@prisma/client'

const COMPLIANCE_OPTIONS: { value: ComplianceStatus; label: string }[] = [
  { value: 'EJ_PABORJAD', label: 'Ej påbörjad' },
  { value: 'PAGAENDE', label: 'Pågående' },
  { value: 'UPPFYLLD', label: 'Uppfylld' },
  { value: 'EJ_UPPFYLLD', label: 'Ej uppfylld' },
  { value: 'EJ_TILLAMPLIG', label: 'Ej tillämplig' },
]

function getComplianceLabel(status: ComplianceStatus): string {
  return COMPLIANCE_OPTIONS.find((o) => o.value === status)?.label ?? status
}

interface LawListItemDetailProps {
  data: LawListItemDetailData
}

export function LawListItemDetail({ data }: LawListItemDetailProps) {
  const { addSystemMessage } = useChatDetail()
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus>(
    data.complianceStatus
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleStatusChange = async (newStatus: ComplianceStatus) => {
    setComplianceStatus(newStatus)
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const result = await updateListItem({
        listItemId: data.id,
        complianceStatus: newStatus,
      })
      if (result.success) {
        setSaved(true)
        addSystemMessage(`Status uppdaterad: ${getComplianceLabel(newStatus)}`)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setSaveError(result.error ?? 'Kunde inte uppdatera status')
      }
    } catch {
      setSaveError('Ett oväntat fel uppstod')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Document info */}
      <div>
        <p className="text-sm font-medium">{data.documentTitle}</p>
        <p className="text-xs text-muted-foreground">{data.documentNumber}</p>
      </div>

      {/* Compliance status (editable) */}
      <div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
          Efterlevnadsstatus
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={complianceStatus}
            onValueChange={(v) => handleStatusChange(v as ComplianceStatus)}
          >
            <SelectTrigger className="h-8 text-sm w-48">
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
          {saving && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {saved && <Check className="h-3.5 w-3.5 text-emerald-500" />}
        </div>
        {saveError && (
          <p className="text-xs text-destructive mt-1">{saveError}</p>
        )}
      </div>

      {/* Group */}
      {data.group && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Grupp
          </p>
          <Badge variant="secondary">{data.group.name}</Badge>
        </div>
      )}

      {/* Business context notes */}
      {data.businessContext && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Verksamhetskontext
          </p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {data.businessContext}
          </p>
        </div>
      )}

      {/* Last change acknowledged */}
      {data.lastChangeAcknowledgedAt && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Senaste ändring bekräftad
          </p>
          <p className="text-sm text-muted-foreground">
            {new Date(data.lastChangeAcknowledgedAt).toLocaleDateString(
              'sv-SE',
              {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }
            )}
          </p>
        </div>
      )}

      {/* Navigation */}
      <Button variant="outline" size="sm" className="gap-1.5" asChild>
        <a href={`/app/laglista?list=${data.lawListId}&item=${data.id}`}>
          Visa i laglistan
          <ExternalLink className="h-3 w-3" />
        </a>
      </Button>
    </div>
  )
}
