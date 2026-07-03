'use client'

/**
 * Story 7.5: Kollektivavtal upload form — the ONE form both entry points
 * mount (Settings tab directly via KollektivavtalManager; HR area via
 * KollektivavtalUploadDialog). Calls the shared `uploadCollectiveAgreement`
 * server action (gated `employees:manage`).
 *
 * Fields: Namn (required), Typ (Arbetare → ARB / Tjänstemän → TJM /
 * Övrigt → null), optional giltighetsperiod (from/to) and the PDF itself
 * (≤25MB). Server action re-validates everything — this is UX validation.
 */

import { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
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
import { DatePicker, toISODate } from '@/components/ui/date-picker'
import {
  uploadCollectiveAgreement,
  type CollectiveAgreementListItem,
} from '@/app/actions/collective-agreements'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB — mirrors the server action
const PDF_MIME_TYPE = 'application/pdf'

/** Typ select values — `OVRIGT` maps to `personel_type: null` on the wire. */
const TYP_OPTIONS = [
  { value: 'ARB', label: 'Arbetare' },
  { value: 'TJM', label: 'Tjänstemän' },
  { value: 'OVRIGT', label: 'Övrigt' },
] as const

type TypValue = (typeof TYP_OPTIONS)[number]['value']

export interface KollektivavtalUploadFormProps {
  onUploaded: (_agreement: CollectiveAgreementListItem) => void
  onCancel?: (() => void) | undefined
}

export function KollektivavtalUploadForm({
  onUploaded,
  onCancel,
}: KollektivavtalUploadFormProps) {
  const [name, setName] = useState('')
  const [typ, setTyp] = useState<TypValue>('OVRIGT')
  const [effectiveFrom, setEffectiveFrom] = useState<Date | null>(null)
  const [effectiveTo, setEffectiveTo] = useState<Date | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<{
    name?: string
    file?: string
    period?: string
  }>({})
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Namn krävs.'
    else if (name.trim().length > 200) next.name = 'Max 200 tecken.'
    if (!file) next.file = 'Välj en PDF-fil.'
    else if (file.type !== PDF_MIME_TYPE)
      next.file = 'Endast PDF-filer kan laddas upp.'
    else if (file.size > MAX_FILE_SIZE)
      next.file = 'Filen är för stor (max 25MB).'
    if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo)
      next.period = 'Slutdatum måste vara efter startdatum.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    // The HR mount renders this form in a Dialog PORTALed out of the
    // Personalkort <form>. React synthetic events still bubble through the
    // React tree (not the DOM tree), so without this the upload submit would
    // also submit-validate the Personalkort form behind the dialog.
    event.stopPropagation()
    if (!validate() || !file) return

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('name', name.trim())
      formData.set('personel_type', typ === 'OVRIGT' ? '' : typ)
      formData.set(
        'effective_from',
        effectiveFrom ? toISODate(effectiveFrom) : ''
      )
      formData.set('effective_to', effectiveTo ? toISODate(effectiveTo) : '')

      const result = await uploadCollectiveAgreement(formData)
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'Kunde inte ladda upp kollektivavtalet.')
        return
      }

      toast.success(
        'Kollektivavtalet laddades upp. Bearbetningen startar strax.'
      )
      setName('')
      setTyp('OVRIGT')
      setEffectiveFrom(null)
      setEffectiveTo(null)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setErrors({})
      onUploaded(result.data)
    } catch {
      toast.error('Ett oväntat fel uppstod.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="ca-name">
          Namn <span className="text-destructive">*</span>
        </Label>
        <Input
          id="ca-name"
          placeholder="T.ex. Byggnads Kollektivavtal 2024"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          aria-required="true"
          aria-invalid={errors.name ? true : undefined}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ca-typ">Typ</Label>
        <Select
          value={typ}
          onValueChange={(v) => setTyp(v as TypValue)}
          disabled={submitting}
        >
          <SelectTrigger id="ca-typ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYP_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>
          Giltighetsperiod{' '}
          <span className="text-xs font-normal text-muted-foreground">
            (valfritt)
          </span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <DatePicker
            id="ca-effective-from"
            value={effectiveFrom}
            onChange={setEffectiveFrom}
            placeholder="Från"
            disabled={submitting}
          />
          <DatePicker
            id="ca-effective-to"
            value={effectiveTo}
            onChange={setEffectiveTo}
            placeholder="Till"
            disabled={submitting}
          />
        </div>
        {errors.period && (
          <p className="text-sm text-destructive">{errors.period}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ca-file">
          PDF-fil <span className="text-destructive">*</span>
        </Label>
        <Input
          id="ca-file"
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={submitting}
          aria-required="true"
          aria-invalid={errors.file ? true : undefined}
        />
        {errors.file && (
          <p className="text-sm text-destructive">{errors.file}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Avbryt
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Ladda upp
        </Button>
      </div>
    </form>
  )
}
