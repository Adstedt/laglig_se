/**
 * Story 21.5 — Shared Swedish copy + Tailwind palette for cycle-item
 * bedömning. Extracted to prevent drift across consumers (Items tab
 * inline editor, read-only badge, Story 21.7 findings editor, Story
 * 21.11 rapport renderer). Constants-only; no React imports.
 *
 * Palette values mirror COMPLIANCE_STATUS_OPTIONS in
 * components/features/document-list/table-cell-editors/compliance-status-editor.tsx:26-64.
 */

import { EfterlevnadsBedomning } from '@prisma/client'

export interface BedomningOption {
  value: EfterlevnadsBedomning
  label: string
  color: string
  strikethrough?: boolean
}

export const BEDOMNING_OPTIONS: BedomningOption[] = [
  {
    value: EfterlevnadsBedomning.UPPFYLLD,
    label: 'Uppfylld',
    color: 'bg-green-100 text-green-700',
  },
  {
    value: EfterlevnadsBedomning.DELVIS,
    label: 'Delvis',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    value: EfterlevnadsBedomning.EJ_UPPFYLLD,
    label: 'Ej uppfylld',
    color: 'bg-red-100 text-red-700',
  },
  {
    value: EfterlevnadsBedomning.EJ_TILLAMPLIG,
    label: 'Ej tillämplig',
    color: 'bg-gray-100 text-gray-500',
    strikethrough: true,
  },
]

export const BEDOMNING_NULL_LABEL = '—'
export const BEDOMNING_NULL_COLOR = 'bg-muted text-muted-foreground'

export function getBedomningOption(
  value: EfterlevnadsBedomning | null
): BedomningOption | null {
  if (value === null) return null
  return BEDOMNING_OPTIONS.find((o) => o.value === value) ?? null
}
