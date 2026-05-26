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
