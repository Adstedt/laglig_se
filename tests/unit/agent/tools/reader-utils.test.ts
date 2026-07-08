/**
 * Unit tests for the shared reader shaping helpers (Story 19.4, Task 1).
 * Covers the cap/name/date helpers + the CP-001 enum→Swedish-label helpers
 * directly (they were previously only exercised transitively via the tool
 * tests). `truncateMarkdown` boundary: maxChars = maxTokens * 4.
 */

import { it, expect } from 'vitest'
import {
  shortText,
  userName,
  userNameOrNull,
  isoDate,
  complianceStatusLabel,
  priorityLabel,
  impactLevelLabel,
  cycleStatusLabel,
  findingTypeLabel,
  findingSeverityLabel,
  auditTypeLabel,
  bedomningLabel,
  parseScopeSummary,
} from '@/lib/agent/tools/reader-utils'

// ---------------------------------------------------------------------------
// shortText
// ---------------------------------------------------------------------------

it('shortText: null / undefined / empty / whitespace → null', () => {
  expect(shortText(null)).toBeNull()
  expect(shortText(undefined)).toBeNull()
  expect(shortText('')).toBeNull()
  expect(shortText('   ')).toBeNull()
})

it('shortText: under budget → unchanged', () => {
  expect(shortText('Kort text', 80)).toBe('Kort text')
})

it('shortText: over budget → truncated with the marker', () => {
  // maxTokens 80 → maxChars 320; single long line (no newline) so the cut
  // point is maxChars and the truncation marker is appended.
  const long = 'a'.repeat(400)
  const result = shortText(long, 80)
  expect(result).not.toBeNull()
  expect(result).toContain('[... innehållet trunkerat]')
  // body is capped at maxChars (320) before the appended marker
  expect(result!.startsWith('a'.repeat(320))).toBe(true)
  expect(result!.length).toBeLessThan(long.length)
})

// ---------------------------------------------------------------------------
// userName / userNameOrNull
// ---------------------------------------------------------------------------

it('userName: name wins → email fallback → "Okänd"', () => {
  expect(userName({ name: 'Anna', email: 'anna@x.se' })).toBe('Anna')
  expect(userName({ name: null, email: 'bob@x.se' })).toBe('bob@x.se')
  expect(userName({ name: null, email: null })).toBe('Okänd')
  expect(userName(null)).toBe('Okänd')
  expect(userName(undefined)).toBe('Okänd')
})

it('userNameOrNull: null user → null; otherwise same as userName', () => {
  expect(userNameOrNull(null)).toBeNull()
  expect(userNameOrNull(undefined)).toBeNull()
  expect(userNameOrNull({ name: 'Anna', email: 'anna@x.se' })).toBe('Anna')
  expect(userNameOrNull({ name: null, email: 'bob@x.se' })).toBe('bob@x.se')
  expect(userNameOrNull({ name: null, email: null })).toBe('Okänd')
})

// ---------------------------------------------------------------------------
// isoDate
// ---------------------------------------------------------------------------

it('isoDate: Date → ISO string; null/undefined → null', () => {
  const d = new Date('2026-03-01T00:00:00.000Z')
  expect(isoDate(d)).toBe('2026-03-01T00:00:00.000Z')
  expect(isoDate(null)).toBeNull()
  expect(isoDate(undefined)).toBeNull()
})

// ---------------------------------------------------------------------------
// Enum → canonical Swedish label (CP-001 family)
// ---------------------------------------------------------------------------

it('complianceStatusLabel: maps enum → label; null → null', () => {
  expect(complianceStatusLabel('PAGAENDE')).toBe('Delvis uppfylld')
  expect(complianceStatusLabel('EJ_PABORJAD')).toBe('Ej påbörjad')
  expect(complianceStatusLabel(null)).toBeNull()
  expect(complianceStatusLabel(undefined)).toBeNull()
})

it('priorityLabel: maps enum → label; null → null', () => {
  expect(priorityLabel('MEDIUM')).toBe('Medel')
  expect(priorityLabel('HIGH')).toBe('Hög')
  expect(priorityLabel(null)).toBeNull()
  expect(priorityLabel(undefined)).toBeNull()
})

it('impactLevelLabel: maps enum → label; null → null', () => {
  expect(impactLevelLabel('HIGH')).toBe('Hög')
  expect(impactLevelLabel('NONE')).toBe('Ingen')
  expect(impactLevelLabel(null)).toBeNull()
  expect(impactLevelLabel(undefined)).toBeNull()
})

// ---------------------------------------------------------------------------
// Story 29.1: cycle-graph labels (CP-001 family)
// ---------------------------------------------------------------------------

it('cycleStatusLabel: maps enum → label; null → null', () => {
  expect(cycleStatusLabel('PLANERAD')).toBe('Planerad')
  expect(cycleStatusLabel('PAGAENDE')).toBe('Pågående')
  expect(cycleStatusLabel('AVSLUTAD')).toBe('Avslutad')
  expect(cycleStatusLabel(null)).toBeNull()
  expect(cycleStatusLabel(undefined)).toBeNull()
})

it('findingTypeLabel: maps enum → label; null → null', () => {
  expect(findingTypeLabel('AVVIKELSE')).toBe('Avvikelse')
  expect(findingTypeLabel('OBSERVATION')).toBe('Observation')
  expect(findingTypeLabel('FORBATTRING')).toBe('Förbättringsförslag')
  expect(findingTypeLabel(null)).toBeNull()
  expect(findingTypeLabel(undefined)).toBeNull()
})

it('findingSeverityLabel: maps enum → label; null → null (only AVVIKELSE carries one)', () => {
  expect(findingSeverityLabel('MAJOR')).toBe('Större')
  expect(findingSeverityLabel('MINOR')).toBe('Mindre')
  expect(findingSeverityLabel(null)).toBeNull()
  expect(findingSeverityLabel(undefined)).toBeNull()
})

it('auditTypeLabel: maps enum → label; null → null', () => {
  expect(auditTypeLabel('INTERN')).toBe('Intern revision')
  expect(auditTypeLabel('EXTERN')).toBe('Extern revision')
  expect(auditTypeLabel(null)).toBeNull()
  expect(auditTypeLabel(undefined)).toBeNull()
})

it('bedomningLabel: maps enum → label; null → null', () => {
  expect(bedomningLabel('UPPFYLLD')).toBe('Uppfylld')
  expect(bedomningLabel('DELVIS')).toBe('Delvis')
  expect(bedomningLabel('EJ_UPPFYLLD')).toBe('Ej uppfylld')
  expect(bedomningLabel('EJ_TILLAMPLIG')).toBe('Ej tillämplig')
  expect(bedomningLabel(null)).toBeNull()
  expect(bedomningLabel(undefined)).toBeNull()
})

// ---------------------------------------------------------------------------
// Story 29.1: parseScopeSummary (defensive Json parsing)
// ---------------------------------------------------------------------------

it('parseScopeSummary: all three kinds parse with their counts', () => {
  expect(parseScopeSummary({ kind: 'all' }, 42)).toEqual({
    kind: 'all',
    groupCount: null,
    itemCount: null,
    materialisedItemCount: 42,
  })
  expect(
    parseScopeSummary({ kind: 'groups', groupIds: ['g1', 'g2'] }, 10)
  ).toEqual({
    kind: 'groups',
    groupCount: 2,
    itemCount: null,
    materialisedItemCount: 10,
  })
  expect(
    parseScopeSummary({ kind: 'items', itemIds: ['i1', 'i2', 'i3'] }, 3)
  ).toEqual({
    kind: 'items',
    groupCount: null,
    itemCount: 3,
    materialisedItemCount: 3,
  })
})

it('parseScopeSummary: malformed/unknown Json → all-fallback, never throws', () => {
  const fallback = {
    kind: 'all',
    groupCount: null,
    itemCount: null,
    materialisedItemCount: 7,
  }
  expect(parseScopeSummary(null, 7)).toEqual(fallback)
  expect(parseScopeSummary(undefined, 7)).toEqual(fallback)
  expect(parseScopeSummary('garbage', 7)).toEqual(fallback)
  expect(parseScopeSummary({ kind: 'unknown-kind' }, 7)).toEqual(fallback)
  // groups without a groupIds array → kind kept, count null
  expect(parseScopeSummary({ kind: 'groups', groupIds: 'oops' }, 7)).toEqual({
    kind: 'groups',
    groupCount: null,
    itemCount: null,
    materialisedItemCount: 7,
  })
})
