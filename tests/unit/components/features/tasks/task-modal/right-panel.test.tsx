/**
 * Story 21.8 — TEST-001 (PO gate-review)
 *
 * Integration test pinning the right-rail card order. The component-level
 * `linked-cycles-box.test.tsx` covers the LinkedCyclesBox render in isolation;
 * this file pins that LinkedCyclesBox sits between QuickLinksBox and
 * LinkedLawsBox inside `right-panel.tsx` — a future refactor reordering the
 * stack would fail this test.
 *
 * Strategy: mock each sibling card to a DOM marker, so the test is purely
 * about ORDER, not inner behaviour.
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { RightPanel } from '@/components/features/tasks/task-modal/right-panel'
import type { TaskDetails } from '@/app/actions/task-modal'
import type { TaskColumnWithCount } from '@/app/actions/tasks'

vi.mock('@/components/features/tasks/task-modal/details-box', () => ({
  DetailsBox: () => <div data-testid="marker-details">details</div>,
}))
vi.mock('@/components/features/tasks/task-modal/quick-links-box', () => ({
  QuickLinksBox: () => <div data-testid="marker-quick-links">quick-links</div>,
}))
vi.mock('@/components/features/tasks/task-modal/linked-cycles-box', () => ({
  LinkedCyclesBox: (props: {
    cycles: TaskDetails['linkedCycles']
    correctiveActionFinding: TaskDetails['complianceFinding']
  }) =>
    props.cycles.length > 0 ? (
      <div data-testid="marker-linked-cycles">linked-cycles</div>
    ) : null,
}))
vi.mock('@/components/features/tasks/task-modal/linked-laws-box', () => ({
  LinkedLawsBox: () => <div data-testid="marker-linked-laws">linked-laws</div>,
}))

const CYCLE_ID = 'cycle-1'

function makeTaskDetails(overrides: Partial<TaskDetails> = {}): TaskDetails {
  return {
    id: 'task-1',
    workspace_id: 'ws-1',
    title: 'Test',
    description: null,
    column_id: 'col-1',
    position: 0,
    priority: 'MEDIUM',
    due_date: null,
    assignee_id: null,
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    completed_at: null,
    labels: [],
    column: { id: 'col-1', name: 'To Do', color: '#ccc', is_done: false },
    assignee: null,
    creator: {
      id: 'user-1',
      name: 'U',
      email: 'u@test.com',
      avatar_url: null,
    },
    list_item_links: [],
    comments: [],
    evidence: [],
    _count: { comments: 0, evidence: 0 },
    complianceFinding: null,
    linkedCycles: [],
    ...overrides,
  }
}

const columns: TaskColumnWithCount[] = []
const members: never[] = []

describe('RightPanel — Story 21.8 card-order integration', () => {
  it('renders DetailsBox → QuickLinksBox → LinkedCyclesBox → LinkedLawsBox when linkedCycles has entries', () => {
    const task = makeTaskDetails({
      linkedCycles: [
        {
          id: CYCLE_ID,
          name: 'Q2 Intern',
          status: 'PAGAENDE',
          itemCount: 10,
        },
      ],
    })
    const { container } = render(
      <RightPanel
        task={task}
        workspaceMembers={members}
        columns={columns}
        onUpdate={async () => {}}
      />
    )
    const markers = Array.from(
      container.querySelectorAll('[data-testid^="marker-"]')
    ).map((n) => n.getAttribute('data-testid'))
    expect(markers).toEqual([
      'marker-details',
      'marker-quick-links',
      'marker-linked-cycles',
      'marker-linked-laws',
    ])
  })

  it('collapses LinkedCyclesBox when linkedCycles is empty — remaining order preserved, no gap', () => {
    const task = makeTaskDetails({ linkedCycles: [] })
    const { container } = render(
      <RightPanel
        task={task}
        workspaceMembers={members}
        columns={columns}
        onUpdate={async () => {}}
      />
    )
    const markers = Array.from(
      container.querySelectorAll('[data-testid^="marker-"]')
    ).map((n) => n.getAttribute('data-testid'))
    // LinkedCyclesBox returns null → marker absent; remaining three stay in order.
    expect(markers).toEqual([
      'marker-details',
      'marker-quick-links',
      'marker-linked-laws',
    ])
  })
})
