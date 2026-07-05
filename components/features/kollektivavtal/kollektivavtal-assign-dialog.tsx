'use client'

/**
 * Story 7.6: bulk-assign dialog — Fortnox "Avtal för löner" semantics. Two
 * targeting modes (Personaltyp = the primary flow, or EmployeeGroup), a live
 * preview count ("Tilldelar X anställda") before confirming, and deliberate
 * overwrite of existing assignments for the targeted employees. The server
 * action re-verifies workspace ownership of both agreement and group.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  assignCollectiveAgreementBulk,
  previewBulkAssignCount,
  type BulkAssignTarget,
  type CollectiveAgreementListItem,
} from '@/app/actions/collective-agreements'
import {
  getEmployeeGroups,
  type EmployeeGroupSummary,
} from '@/app/actions/employees'

type TargetMode = 'personel_type' | 'group'

const PERSONALTYP_OPTIONS = [
  { value: 'ARB', label: 'Arbetare' },
  { value: 'TJM', label: 'Tjänstemän' },
] as const

type PersonaltypValue = (typeof PERSONALTYP_OPTIONS)[number]['value']

export interface KollektivavtalAssignDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  agreement: CollectiveAgreementListItem | null
  /** Called with the number of employees assigned (list refresh lives here). */
  onAssigned: (_assignedCount: number) => void
}

function previewLabel(count: number): string {
  if (count === 0) return 'Inga anställda matchar valet.'
  if (count === 1) return 'Tilldelar 1 anställd.'
  return `Tilldelar ${count} anställda.`
}

export function KollektivavtalAssignDialog({
  open,
  onOpenChange,
  agreement,
  onAssigned,
}: KollektivavtalAssignDialogProps) {
  const [mode, setMode] = useState<TargetMode>('personel_type')
  const [personaltyp, setPersonaltyp] = useState<PersonaltypValue>('ARB')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groups, setGroups] = useState<EmployeeGroupSummary[] | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Reset per agreement each time the dialog opens; default the Personaltyp
  // to the agreement's own typ (ARB-avtal → Arbetare) when it has one.
  useEffect(() => {
    if (!open || !agreement) return
    setMode('personel_type')
    setPersonaltyp(agreement.personel_type ?? 'ARB')
    setGroupId(null)
    setCount(null)
  }, [open, agreement])

  // Lazy group fetch, once per mount cycle of the dialog.
  useEffect(() => {
    if (!open || mode !== 'group' || groups !== null) return
    let cancelled = false
    void getEmployeeGroups().then((result) => {
      if (cancelled) return
      setGroups(result.success && result.data ? result.data : [])
    })
    return () => {
      cancelled = true
    }
  }, [open, mode, groups])

  const target: BulkAssignTarget | null = useMemo(
    () =>
      mode === 'personel_type'
        ? { kind: 'personel_type', value: personaltyp }
        : groupId
          ? { kind: 'group', groupId }
          : null,
    [mode, personaltyp, groupId]
  )

  // Live preview count — same compound filter as the mutation.
  const targetKey = target ? JSON.stringify(target) : null
  useEffect(() => {
    if (!open || !targetKey) {
      setCount(null)
      return
    }
    let cancelled = false
    setCount(null)
    void previewBulkAssignCount(JSON.parse(targetKey) as BulkAssignTarget).then(
      (result) => {
        if (cancelled) return
        setCount(result.success && result.data ? result.data.count : null)
      }
    )
    return () => {
      cancelled = true
    }
  }, [open, targetKey])

  const handleConfirm = useCallback(async () => {
    if (!agreement || !target) return
    setSubmitting(true)
    try {
      const result = await assignCollectiveAgreementBulk(agreement.id, target)
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'Kunde inte tilldela kollektivavtalet.')
        return
      }
      const assigned = result.data.assigned
      toast.success(
        assigned === 1
          ? `1 anställd tilldelades ${agreement.name}.`
          : `${assigned} anställda tilldelades ${agreement.name}.`
      )
      onAssigned(assigned)
      onOpenChange(false)
    } catch {
      toast.error('Ett oväntat fel uppstod.')
    } finally {
      setSubmitting(false)
    }
  }, [agreement, target, onAssigned, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tilldela kollektivavtal</DialogTitle>
          <DialogDescription>
            Tilldela {agreement?.name ?? 'avtalet'} till flera anställda
            samtidigt. Befintliga tilldelningar för de valda anställda skrivs
            över.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-safiro font-medium">Tilldela efter</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              className="justify-start"
              value={mode}
              onValueChange={(value) => {
                if (value) setMode(value as TargetMode)
              }}
              disabled={submitting}
            >
              <ToggleGroupItem value="personel_type">
                Personaltyp
              </ToggleGroupItem>
              <ToggleGroupItem value="group">Grupp</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {mode === 'personel_type' ? (
            <div className="space-y-1.5">
              <Label htmlFor="ca-assign-personaltyp">Personaltyp</Label>
              <Select
                value={personaltyp}
                onValueChange={(v) => setPersonaltyp(v as PersonaltypValue)}
                disabled={submitting}
              >
                <SelectTrigger id="ca-assign-personaltyp">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONALTYP_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="ca-assign-group">Grupp</Label>
              <Select
                value={groupId ?? ''}
                onValueChange={(v) => setGroupId(v || null)}
                disabled={submitting || groups === null}
              >
                <SelectTrigger id="ca-assign-group">
                  <SelectValue
                    placeholder={
                      groups === null ? 'Hämtar grupper…' : 'Välj grupp'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(groups ?? []).map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {groups !== null && groups.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Det finns inga grupper i personalregistret än.
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {target === null
              ? 'Välj ett mål för tilldelningen.'
              : count === null
                ? 'Räknar anställda…'
                : previewLabel(count)}
          </p>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !target || !count}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tilldela
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
