import { describe, it, expect, vi } from 'vitest'
import {
  getStatusBadgeProps,
  getPriorityBadgeProps,
  TONES,
  VARIANTS,
} from '@/lib/ui/badge-tones'

/**
 * Story 22.1 — exhaustive enum-mapping coverage for the helper functions.
 * Each domain × value has a single canonical (tone, variant, label) — these
 * tests pin those expectations so visual drift fails CI before it ships.
 */

describe('getStatusBadgeProps — compliance-status (Prisma enum: 5 values)', () => {
  it.each([
    ['EJ_PABORJAD', 'neutral', 'soft', 'Ej påbörjad'],
    // Story 6.16 — PAGAENDE renamed "Pågående" → "Delvis uppfylld" in the
    // compliance-status context (cycle-status keeps "Pågående").
    ['PAGAENDE', 'info', 'soft', 'Delvis uppfylld'],
    ['UPPFYLLD', 'success', 'soft', 'Uppfylld'],
    ['EJ_UPPFYLLD', 'danger', 'soft', 'Ej uppfylld'],
    ['EJ_TILLAMPLIG', 'neutral', 'outline', 'Ej tillämplig'],
  ])('%s → tone=%s, variant=%s, label=%s', (value, tone, variant, label) => {
    expect(getStatusBadgeProps('compliance-status', value)).toEqual({
      tone,
      variant,
      label,
    })
  })
})

describe('getStatusBadgeProps — cycle-status', () => {
  it.each([
    ['PLANERAD', 'neutral', 'soft', 'Planerad'],
    ['PAGAENDE', 'info', 'soft', 'Pågående'],
    ['AVSLUTAD', 'success', 'soft', 'Avslutad'],
    ['SEALED', 'success', 'solid', 'Fastställd'],
    ['ARKIVERAD', 'neutral', 'outline', 'Arkiverad'],
  ])('%s → tone=%s, variant=%s, label=%s', (value, tone, variant, label) => {
    expect(getStatusBadgeProps('cycle-status', value)).toEqual({
      tone,
      variant,
      label,
    })
  })
})

describe('getStatusBadgeProps — document-status', () => {
  it.each([
    ['DRAFT', 'neutral', 'soft', 'Utkast'],
    ['IN_REVIEW', 'info', 'soft', 'Under granskning'],
    ['APPROVED', 'success', 'soft', 'Godkänd'],
    ['SUPERSEDED', 'neutral', 'outline', 'Ersatt'],
    ['ARCHIVED', 'neutral', 'outline', 'Arkiverad'],
  ])('%s → tone=%s, variant=%s, label=%s', (value, tone, variant, label) => {
    expect(getStatusBadgeProps('document-status', value)).toEqual({
      tone,
      variant,
      label,
    })
  })
})

describe('getStatusBadgeProps — finding-severity (Prisma MAJOR | MINOR)', () => {
  it.each([
    ['MAJOR', 'danger', 'soft', 'Större'],
    ['MINOR', 'warning', 'soft', 'Mindre'],
  ])('%s → tone=%s, variant=%s, label=%s', (value, tone, variant, label) => {
    expect(getStatusBadgeProps('finding-severity', value)).toEqual({
      tone,
      variant,
      label,
    })
  })
})

describe('getStatusBadgeProps — finding-type', () => {
  it.each([
    ['AVVIKELSE', 'danger', 'soft', 'Avvikelse'],
    ['OBSERVATION', 'warning', 'soft', 'Observation'],
    ['FORBATTRING', 'info', 'soft', 'Förbättringsförslag'],
  ])('%s → tone=%s, variant=%s, label=%s', (value, tone, variant, label) => {
    expect(getStatusBadgeProps('finding-type', value)).toEqual({
      tone,
      variant,
      label,
    })
  })
})

describe('getStatusBadgeProps — fallback', () => {
  it('returns a neutral-soft fallback with the raw value as label for unknown enum keys', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const props = getStatusBadgeProps('cycle-status', 'NOT_A_STATUS')
    expect(props).toEqual({
      tone: 'neutral',
      variant: 'soft',
      label: 'NOT_A_STATUS',
    })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('getPriorityBadgeProps', () => {
  it.each([
    ['CRITICAL', 'danger', 'solid', 'Kritisk'],
    ['HIGH', 'danger', 'soft', 'Hög'],
    ['MEDIUM', 'warning', 'soft', 'Medel'],
    ['LOW', 'neutral', 'soft', 'Låg'],
  ] as const)(
    '%s → tone=%s, variant=%s, label=%s',
    (value, tone, variant, label) => {
      expect(getPriorityBadgeProps(value)).toEqual({ tone, variant, label })
    }
  )
})

describe('TONES / VARIANTS const arrays', () => {
  it('TONES is the canonical 5-tone list', () => {
    expect(TONES).toEqual(['neutral', 'info', 'success', 'warning', 'danger'])
  })

  it('VARIANTS is the canonical 3-variant list', () => {
    expect(VARIANTS).toEqual(['soft', 'solid', 'outline'])
  })
})
