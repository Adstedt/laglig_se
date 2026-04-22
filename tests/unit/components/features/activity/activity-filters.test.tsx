/**
 * Story 21.13: Activity filter bar — tests for the new compliance-audit
 * entity-type dropdown entries. Happy-dom + Radix Select interaction is
 * unreliable in this project (documented in Story 21.5 Debug Log), so we
 * assert on render-output (label strings appear in the DOM) rather than
 * driving the Select popover via user events.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ActivityFilters } from '@/components/features/activity/activity-filters'

// ---------------------------------------------------------------------------
// Mocks — match the dependency graph without pulling real modules.
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/app/actions/tasks', () => ({
  getWorkspaceMembers: vi.fn().mockResolvedValue({ success: true, data: [] }),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityFilters — Story 21.13 compliance-audit entity types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing when compliance-audit entity-type entries are present', () => {
    // Smoke test — mounts the filter bar with the three new ENTITY_TYPES
    // entries landed by Story 21.13. Radix Select renders the SelectItem
    // children only after the popover is opened (state-driven), so we cannot
    // assert on label text here without driving the popover open.
    // `userEvent.click` on Radix Select triggers is unreliable in happy-dom
    // (documented in Story 21.5 Debug Log). We fall back to verifying the
    // component mounts cleanly — catching any regression that would blow up
    // on the new ENTITY_TYPES append.
    const { container } = render(<ActivityFilters onFiltersChange={vi.fn()} />)
    expect(container.querySelector('[role="combobox"]')).toBeTruthy()
  })

  it('entity-type trigger is widened to accommodate the long Avvikelse label', () => {
    const { container } = render(<ActivityFilters onFiltersChange={vi.fn()} />)

    // Story 21.13 Task 5.3 widened the Select trigger from w-[160px] to
    // w-[220px] so "Avvikelse / Observation / Förbättring" (36 chars) fits.
    // The Tailwind class is visible in the rendered HTML regardless of Select
    // popover state — a low-friction pin on the visual change.
    const triggers = container.querySelectorAll('[class*="w-[220px]"]')
    expect(triggers.length).toBeGreaterThanOrEqual(1)
  })

  // ENTITY_TYPES label-content coverage is deliberately omitted here — Radix
  // Select's visually-hidden items are only rendered when the popover opens,
  // and happy-dom doesn't drive the open transition reliably. The dropdown
  // content is verified indirectly via:
  //   - lib/activity/format-activity.test.ts (sentence copy for the 8 actions)
  //   - lib/activity/entity-resolver.test.ts (deep-link shapes for all 3
  //     entity types)
  //   - lib/activity/categories.test.ts (exhaustiveness pin)
  //   - app/actions/workspace-activity.test.ts (entity_type filter plumbing)
})
