/**
 * Epic 21 follow-up — verify-step derivation helper tests.
 * Pure function; no fixtures or setup beyond the minimal FindingRow shape.
 */

import { describe, it, expect } from 'vitest'
import { getFindingStatus } from '@/components/features/compliance-audit/finding-copy'
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

describe('getFindingStatus', () => {
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

  it("returns 'closed' when finding is closed regardless of task state", () => {
    // Closed with no task
    expect(
      getFindingStatus(
        makeFinding({ closedAt: new Date('2026-05-20T10:00:00Z') })
      )
    ).toBe('closed')

    // Closed with completed task
    const withCompletedTask = makeFinding({
      closedAt: new Date('2026-05-20T10:00:00Z'),
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Fix',
        completedAt: new Date('2026-05-15T10:00:00Z'),
      },
    })
    expect(getFindingStatus(withCompletedTask)).toBe('closed')

    // Closed with incomplete task (manual-override path)
    const withIncompleteTask = makeFinding({
      closedAt: new Date('2026-05-20T10:00:00Z'),
      correctiveActionTaskId: 'task-1',
      correctiveActionTask: {
        id: 'task-1',
        title: 'Fix',
        completedAt: null,
      },
    })
    expect(getFindingStatus(withIncompleteTask)).toBe('closed')
  })
})
