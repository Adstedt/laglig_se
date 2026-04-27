/**
 * Reframing pass — verify dialog: clickable task link + new CTA copy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FindingSeverity, FindingType } from '@prisma/client'
import type { FindingRow } from '@/app/actions/compliance-finding'
import { VerifyFindingDialog } from '@/components/features/compliance-audit/cycle-detail/verify-finding-dialog'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

function makeFindingWithCompletedTask(
  overrides: Partial<FindingRow> = {}
): FindingRow {
  return {
    id: 'f-verify',
    cycleId: 'c-1',
    type: FindingType.AVVIKELSE,
    severity: FindingSeverity.MAJOR,
    title: 'Saknar brandskyddsplan',
    description: 'Body',
    rootCause: null,
    dueDate: null,
    closedAt: null,
    closedBy: null,
    lawListItemId: null,
    lawListItem: null,
    requirementId: null,
    requirement: null,
    correctiveActionTaskId: 'task-42',
    correctiveActionTask: {
      id: 'task-42',
      title: 'Skriv brandskyddsplan',
      completedAt: new Date('2026-04-25T10:00:00Z'),
    },
    createdAt: new Date('2026-04-22T10:00:00Z'),
    updatedAt: new Date('2026-04-22T10:00:00Z'),
    ...overrides,
  }
}

describe('VerifyFindingDialog — reframing pass', () => {
  it('renders task title as a Link to /tasks?task={id} with target=_blank', () => {
    const finding = makeFindingWithCompletedTask()
    render(
      <VerifyFindingDialog
        open
        onOpenChange={() => {}}
        finding={finding}
        onConfirm={vi.fn()}
      />
    )

    const link = screen.getByTestId('verify-finding-task-link')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/tasks?task=task-42')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.textContent).toBe('Skriv brandskyddsplan')
  })

  it('submit CTA reads "Bekräfta åtgärd" (not legacy "Verifiera och stäng")', () => {
    const finding = makeFindingWithCompletedTask()
    render(
      <VerifyFindingDialog
        open
        onOpenChange={() => {}}
        finding={finding}
        onConfirm={vi.fn()}
      />
    )

    const submit = screen.getByTestId('verify-finding-submit')
    expect(submit.textContent).toBe('Bekräfta åtgärd')
    // Regression guard against the legacy bundled-action copy.
    expect(submit.textContent).not.toContain('Verifiera och stäng')
  })

  it('does not render the task link when correctiveActionTask is null (defensive)', () => {
    // Verify dialog is normally only opened on `ready-to-verify` (task !== null)
    // — but the component must not crash if a caller passes a finding with no
    // task. The link is omitted; the rest of the dialog still renders.
    const finding = makeFindingWithCompletedTask({
      correctiveActionTaskId: null,
      correctiveActionTask: null,
    })
    render(
      <VerifyFindingDialog
        open
        onOpenChange={() => {}}
        finding={finding}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.queryByTestId('verify-finding-task-link')).toBeNull()
    expect(screen.getByTestId('verify-finding-submit')).toBeInTheDocument()
    expect(screen.getByTestId('verify-finding-context').textContent).toContain(
      'Saknar brandskyddsplan'
    )
  })
})
