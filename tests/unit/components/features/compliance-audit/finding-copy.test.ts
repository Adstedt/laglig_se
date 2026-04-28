/**
 * Phase 2 / Epic 23 foundation — five-state derivation helper tests.
 * Pure function; no fixtures or setup beyond the minimal FindingRow shape.
 *
 * The five states correspond to:
 *   - `open` — closedAt null, no completed task
 *   - `ready-to-verify` — closedAt null, linked task `completedAt` set
 *   - `closed-verified` — closedAt set, `verificationNote` populated
 *   - `closed-plain` — closedAt set, both metadata fields null
 *   - `closed-dismissed` — closedAt set, `closeReason` populated
 *
 * Precedence on closed: dismissed > verified > plain. (`closeReason` wins
 * over `verificationNote` if somehow both were ever set, which the server
 * action guards against — only one closure path populates one column.)
 */

import { describe, it, expect } from 'vitest'
import {
  FINDING_STATUS_BADGES,
  getFindingStatus,
} from '@/components/features/compliance-audit/finding-copy'
import type { FindingRow } from '@/app/actions/compliance-finding'
import { FindingType } from '@prisma/client'

function makeFinding(overrides: Partial<FindingRow> = {}): FindingRow {
  return {
    id: 'f-1',
    cycleId: 'c-1',
    type: FindingType.AVVIKELSE,
    severity: null,
    title: 'T',
    description: 'D',
    rootCause: null,
    dueDate: null,
    closedAt: null,
    closedBy: null,
    verificationNote: null,
    closeReason: null,
    lawListItemId: null,
    lawListItem: null,
    requirementId: null,
    requirement: null,
    correctiveActionTaskId: null,
    correctiveActionTask: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('getFindingStatus — five-state derivation', () => {
  it("returns 'open' when finding has no task and is not closed", () => {
    expect(getFindingStatus(makeFinding())).toBe('open')
  })

  it("returns 'open' when linked task exists but completedAt is null", () => {
    const finding = makeFinding({
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Fix the thing',
        completedAt: null,
      },
    })
    expect(getFindingStatus(finding)).toBe('open')
  })

  it("returns 'ready-to-verify' when linked task is completed and finding is open", () => {
    const finding = makeFinding({
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Fix the thing',
        completedAt: new Date('2026-05-15T10:00:00Z'),
      },
    })
    expect(getFindingStatus(finding)).toBe('ready-to-verify')
  })

  it("returns 'closed-verified' when verificationNote is set", () => {
    const finding = makeFinding({
      closedAt: new Date('2026-05-20T10:00:00Z'),
      verificationNote: 'Granskade ny skylt 2026-05-19',
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Fix',
        completedAt: new Date('2026-05-15T10:00:00Z'),
      },
    })
    expect(getFindingStatus(finding)).toBe('closed-verified')
  })

  it("returns 'closed-plain' when closed with both metadata fields null", () => {
    const finding = makeFinding({
      closedAt: new Date('2026-05-20T10:00:00Z'),
    })
    expect(getFindingStatus(finding)).toBe('closed-plain')
  })

  it("returns 'closed-dismissed' when closeReason is set (manual-override path)", () => {
    const finding = makeFinding({
      closedAt: new Date('2026-05-20T10:00:00Z'),
      closeReason: 'Verksamheten har förändrats — kravet gäller inte längre',
    })
    expect(getFindingStatus(finding)).toBe('closed-dismissed')
  })

  it('dismissed wins over verified when both metadata fields are populated (defensive)', () => {
    // Defensive — server-side closeFinding does not write both columns in one
    // call, but if data ever ended up in this shape, dismissed takes precedence
    // because the manual-override carries explicit "wrote off without action"
    // intent that should not be hidden behind verification claims.
    const finding = makeFinding({
      closedAt: new Date('2026-05-20T10:00:00Z'),
      verificationNote: 'should be ignored',
      closeReason: 'wins',
    })
    expect(getFindingStatus(finding)).toBe('closed-dismissed')
  })
})

describe('FINDING_STATUS_BADGES — config integrity', () => {
  it('open returns null (no badge rendered for the default state)', () => {
    expect(FINDING_STATUS_BADGES.open).toBeNull()
  })

  it('every non-open state has a label + className', () => {
    const states = [
      'ready-to-verify',
      'closed-verified',
      'closed-plain',
      'closed-dismissed',
    ] as const
    for (const s of states) {
      const cfg = FINDING_STATUS_BADGES[s]
      expect(cfg).not.toBeNull()
      expect(cfg!.label.length).toBeGreaterThan(0)
      expect(cfg!.className.length).toBeGreaterThan(0)
    }
  })

  it("only closed-verified carries the 'check' icon", () => {
    expect(FINDING_STATUS_BADGES['closed-verified']?.icon).toBe('check')
    expect(FINDING_STATUS_BADGES['ready-to-verify']?.icon).toBeUndefined()
    expect(FINDING_STATUS_BADGES['closed-plain']?.icon).toBeUndefined()
    expect(FINDING_STATUS_BADGES['closed-dismissed']?.icon).toBeUndefined()
  })

  it('only closed-dismissed renders with strike-through styling', () => {
    expect(FINDING_STATUS_BADGES['closed-dismissed']?.strike).toBe(true)
    expect(FINDING_STATUS_BADGES['ready-to-verify']?.strike).toBeUndefined()
    expect(FINDING_STATUS_BADGES['closed-verified']?.strike).toBeUndefined()
    expect(FINDING_STATUS_BADGES['closed-plain']?.strike).toBeUndefined()
  })
})
