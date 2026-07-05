'use client'

/**
 * Story 7.6: edit dialog — namn/typ/giltighetsperiod (the upload form's
 * fields minus the file input, via the shared fieldset). Calls
 * `updateCollectiveAgreement` (gated `employees:manage` server-side).
 */

import { useEffect, useState } from 'react'
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
import { parseISODate, toISODate } from '@/components/ui/date-picker'
import {
  updateCollectiveAgreement,
  type CollectiveAgreementListItem,
} from '@/app/actions/collective-agreements'
import {
  KollektivavtalAgreementFields,
  type AgreementFieldErrors,
  type TypValue,
} from './kollektivavtal-agreement-fields'

export interface KollektivavtalEditDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  agreement: CollectiveAgreementListItem | null
  onSaved: (_agreement: CollectiveAgreementListItem) => void
}

export function KollektivavtalEditDialog({
  open,
  onOpenChange,
  agreement,
  onSaved,
}: KollektivavtalEditDialogProps) {
  const [name, setName] = useState('')
  const [typ, setTyp] = useState<TypValue>('OVRIGT')
  const [effectiveFrom, setEffectiveFrom] = useState<Date | null>(null)
  const [effectiveTo, setEffectiveTo] = useState<Date | null>(null)
  const [errors, setErrors] = useState<AgreementFieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  // Prefill from the agreement each time the dialog opens.
  useEffect(() => {
    if (!open || !agreement) return
    setName(agreement.name)
    setTyp(agreement.personel_type ?? 'OVRIGT')
    setEffectiveFrom(parseISODate(agreement.effective_from))
    setEffectiveTo(parseISODate(agreement.effective_to))
    setErrors({})
  }, [open, agreement])

  const validate = (): boolean => {
    const next: AgreementFieldErrors = {}
    if (!name.trim()) next.name = 'Namn krävs.'
    else if (name.trim().length > 200) next.name = 'Max 200 tecken.'
    if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo)
      next.period = 'Slutdatum måste vara efter startdatum.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    // Same portal caveat as the upload form: React synthetic submits bubble
    // through the React tree — never into an ancestor form behind the dialog.
    event.stopPropagation()
    if (!agreement || !validate()) return

    setSubmitting(true)
    try {
      const result = await updateCollectiveAgreement(agreement.id, {
        name: name.trim(),
        personel_type: typ === 'OVRIGT' ? null : typ,
        effective_from: effectiveFrom ? toISODate(effectiveFrom) : null,
        effective_to: effectiveTo ? toISODate(effectiveTo) : null,
      })
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'Kunde inte uppdatera kollektivavtalet.')
        return
      }
      toast.success('Kollektivavtalet uppdaterades.')
      onSaved(result.data)
      onOpenChange(false)
    } catch {
      toast.error('Ett oväntat fel uppstod.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redigera kollektivavtal</DialogTitle>
          <DialogDescription>
            Ändringarna gäller direkt. Dokumentet påverkas inte.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <KollektivavtalAgreementFields
            idPrefix="ca-edit"
            name={name}
            onNameChange={setName}
            typ={typ}
            onTypChange={setTyp}
            effectiveFrom={effectiveFrom}
            onEffectiveFromChange={setEffectiveFrom}
            effectiveTo={effectiveTo}
            onEffectiveToChange={setEffectiveTo}
            errors={errors}
            disabled={submitting}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Spara
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
