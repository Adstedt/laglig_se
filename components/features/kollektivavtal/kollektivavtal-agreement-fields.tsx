'use client'

/**
 * Story 7.6: shared Namn/Typ/Giltighetsperiod fieldset — the upload form's
 * fields minus the file input, so the edit dialog reuses the exact same
 * markup (ids are prefixed to keep both mountable at once).
 */

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'

/** Typ select values — `OVRIGT` maps to `personel_type: null` on the wire. */
export const TYP_OPTIONS = [
  { value: 'ARB', label: 'Arbetare' },
  { value: 'TJM', label: 'Tjänstemän' },
  { value: 'OVRIGT', label: 'Övrigt' },
] as const

export type TypValue = (typeof TYP_OPTIONS)[number]['value']

export interface AgreementFieldErrors {
  name?: string
  period?: string
}

export interface KollektivavtalAgreementFieldsProps {
  /** Element-id prefix — 'ca' (upload form) keeps 7.5's ids unchanged. */
  idPrefix: string
  name: string
  onNameChange: (_value: string) => void
  typ: TypValue
  onTypChange: (_value: TypValue) => void
  effectiveFrom: Date | null
  onEffectiveFromChange: (_value: Date | null) => void
  effectiveTo: Date | null
  onEffectiveToChange: (_value: Date | null) => void
  errors: AgreementFieldErrors
  disabled: boolean
}

export function KollektivavtalAgreementFields({
  idPrefix,
  name,
  onNameChange,
  typ,
  onTypChange,
  effectiveFrom,
  onEffectiveFromChange,
  effectiveTo,
  onEffectiveToChange,
  errors,
  disabled,
}: KollektivavtalAgreementFieldsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>
          Namn <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`${idPrefix}-name`}
          placeholder="T.ex. Byggnads Kollektivavtal 2024"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          aria-required="true"
          aria-invalid={errors.name ? true : undefined}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-typ`}>Typ</Label>
        <Select
          value={typ}
          onValueChange={(v) => onTypChange(v as TypValue)}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-typ`}>
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
            id={`${idPrefix}-effective-from`}
            value={effectiveFrom}
            onChange={onEffectiveFromChange}
            placeholder="Från"
            disabled={disabled}
          />
          <DatePicker
            id={`${idPrefix}-effective-to`}
            value={effectiveTo}
            onChange={onEffectiveToChange}
            placeholder="Till"
            disabled={disabled}
          />
        </div>
        {errors.period && (
          <p className="text-sm text-destructive">{errors.period}</p>
        )}
      </div>
    </>
  )
}
