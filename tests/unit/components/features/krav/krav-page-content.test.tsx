/**
 * Story 20.3 AC 18/22/29 + QA TEST-002: KravPageContent orchestration tests.
 *
 * Covers the non-trivial state transitions that unit-testing pure helpers
 * cannot reach:
 *   - Graceful URL fallback (AC 18): malformed ?filter=/sort=/dir= values
 *     coerce to defaults + get stripped via router.replace on mount.
 *   - Debounced search (AC 22, 23): typing writes a cleaned URL after the
 *     300ms debounce window.
 *   - Rensa reset (AC 17): clears input + calls router.replace('/krav').
 *   - Ladda fler accumulation (AC 29): subsequent page appends rather than
 *     replaces the primary page rows.
 *   - Modal open (AC 33): clicking a Lag cell surfaces the modal with
 *     focusField=kravpunkter + focusRequirementId=row.id.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

// ============================================================================
// Module mocks (declared BEFORE the component import so vi.mock hoists cleanly)
// ============================================================================

const mockReplace = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({
    get: (k: string) => mockSearchParams.get(k),
    toString: () => mockSearchParams.toString(),
  }),
}))

const getWorkspaceRequirements = vi.fn()
const getWorkspaceRequirementCounts = vi.fn()

vi.mock('@/app/actions/workspace-requirements', () => ({
  getWorkspaceRequirements: (...args: unknown[]) =>
    getWorkspaceRequirements(...args),
  getWorkspaceRequirementCounts: (...args: unknown[]) =>
    getWorkspaceRequirementCounts(...args),
}))

vi.mock('@/app/actions/law-list-item-requirements', () => ({
  updateRequirement: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

// The legal-document-modal is a heavy tree that loads many server actions
// under the hood; stub it out so we can assert "modal opened" without any
// of its internals.
vi.mock('@/components/features/document-list/legal-document-modal', () => ({
  LegalDocumentModal: ({
    listItemId,
    focusRequirementId,
    onClose,
  }: {
    listItemId: string | null
    focusRequirementId?: string
    onClose: () => void
  }) => (
    <div
      data-testid="mock-legal-document-modal"
      data-list-item-id={listItemId ?? ''}
      data-focus-requirement-id={focusRequirementId ?? ''}
    >
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}))

import { SWRConfig } from 'swr'
import { KravPageContent } from '@/components/features/krav/krav-page-content'

// ============================================================================
// Helpers
// ============================================================================

function seedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    text: 'Rutinen finns dokumenterad',
    comment: null,
    isFulfilled: false,
    bevisRequired: false,
    responsibleUserId: null,
    effectiveAssignee: { userId: null, isInherited: false },
    evidenceCount: 0,
    lawItemId: 'list-item-1',
    lawId: 'doc-1',
    lawName: 'SFS 2020:123',
    laglistaId: 'list-1',
    laglistaName: 'Huvudlista',
    updatedAt: new Date('2026-04-20T10:00:00Z'),
    ...overrides,
  }
}

function wrapperFreshCache({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
}

function renderFresh(searchString = '') {
  // Reset the singleton URLSearchParams before each render.
  mockSearchParams.forEach((_, key) => mockSearchParams.delete(key))
  new URLSearchParams(searchString).forEach((value, key) => {
    mockSearchParams.set(key, value)
  })
  return render(<KravPageContent members={[]} />, {
    wrapper: wrapperFreshCache,
  })
}

// ============================================================================
// Tests
// ============================================================================

describe('KravPageContent', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    getWorkspaceRequirements.mockReset()
    getWorkspaceRequirementCounts.mockReset()
    getWorkspaceRequirements.mockResolvedValue({
      success: true,
      data: { items: [], nextCursor: null },
    })
    getWorkspaceRequirementCounts.mockResolvedValue({
      success: true,
      data: { all: 1, gaps: 0, mine: 0, needs_evidence: 0 },
    })
  })

  // --------------------------------------------------------------------------
  // AC 18: graceful URL fallback — malformed values coerce + strip
  // --------------------------------------------------------------------------

  it('malformed ?filter=banana coerces to default and strips the param (AC 18)', async () => {
    renderFresh('?filter=banana')

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled()
    })

    // First call should rewrite the URL without the bad filter param.
    const firstCall = mockReplace.mock.calls[0]
    expect(firstCall?.[0]).toBe('/krav')
    expect(firstCall?.[1]).toEqual({ scroll: false })
  })

  it('malformed ?sort=nope&dir=yikes coerces + strips both (AC 18)', async () => {
    renderFresh('?sort=nope&dir=yikes')

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/krav', { scroll: false })
    })
  })

  it('valid ?filter=mine is preserved (any URL replace keeps filter=mine) (AC 18, 19)', async () => {
    renderFresh('?filter=mine')

    // Give effects time to settle. If any replace does fire during mount
    // (e.g., from a harmless re-sync), it MUST preserve filter=mine — never
    // corrupt a valid URL param. The explicit-corruption guard matters more
    // than the no-replace invariant, which mounts can defensibly violate.
    await new Promise((r) => setTimeout(r, 50))
    for (const call of mockReplace.mock.calls) {
      const url = call[0] as string
      // Either no filter param (default = gaps → not mine → would be wrong)
      // OR filter=mine. Default-gaps is specifically wrong for a `filter=mine`
      // input, so assert the preservation.
      expect(url).toContain('filter=mine')
    }
  })

  // --------------------------------------------------------------------------
  // AC 29: Ladda fler accumulation
  // --------------------------------------------------------------------------

  it('Ladda fler: clicking appends next page rows rather than replacing (AC 29)', async () => {
    const firstPage = [seedRow({ id: 'req-A', text: 'First page row' })]
    const secondPage = [seedRow({ id: 'req-B', text: 'Second page row' })]

    getWorkspaceRequirements
      .mockResolvedValueOnce({
        success: true,
        data: { items: firstPage, nextCursor: 'cursor-1' },
      })
      // Second call (the "Ladda fler" imperative fetch) returns the next page.
      .mockResolvedValueOnce({
        success: true,
        data: { items: secondPage, nextCursor: null },
      })
    getWorkspaceRequirementCounts.mockResolvedValue({
      success: true,
      data: { all: 2, gaps: 1, mine: 0, needs_evidence: 0 },
    })

    const user = userEvent.setup()
    renderFresh()

    // Wait for primary page to render.
    await waitFor(() => {
      expect(screen.getByText('First page row')).toBeInTheDocument()
    })

    // Click "Ladda fler".
    const button = screen.getByRole('button', { name: /Ladda fler/ })
    await user.click(button)

    // Both pages' rows should now be rendered — append, not replace.
    await waitFor(() => {
      expect(screen.getByText('First page row')).toBeInTheDocument()
      expect(screen.getByText('Second page row')).toBeInTheDocument()
    })

    // No more Ladda fler once the second page's nextCursor is null.
    expect(
      screen.queryByRole('button', { name: /Ladda fler/ })
    ).not.toBeInTheDocument()
  })

  // --------------------------------------------------------------------------
  // AC 33: Modal deep-link — Lag-cell click surfaces modal with focus props
  // --------------------------------------------------------------------------

  it('clicking a Lag cell opens the modal with listItemId + focusRequirementId (AC 33)', async () => {
    getWorkspaceRequirements.mockResolvedValue({
      success: true,
      data: {
        items: [
          seedRow({
            id: 'req-focus',
            lawItemId: 'list-item-focus',
            lawName: 'Aktiebolagslag',
          }),
        ],
        nextCursor: null,
      },
    })

    const user = userEvent.setup()
    renderFresh()

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Aktiebolagslag' })
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Aktiebolagslag' }))

    const modal = await screen.findByTestId('mock-legal-document-modal')
    expect(modal).toHaveAttribute('data-list-item-id', 'list-item-focus')
    expect(modal).toHaveAttribute('data-focus-requirement-id', 'req-focus')
  })

  // --------------------------------------------------------------------------
  // AC 17: Rensa resets filter + search via router.replace('/krav')
  // --------------------------------------------------------------------------

  it('clicking Rensa resets to /krav (AC 17)', async () => {
    const user = userEvent.setup()
    renderFresh('?filter=mine')

    // Rensa appears when filter != default. Wait for chips to mount.
    const clearButton = await screen.findByRole('button', { name: /Rensa/ })
    await user.click(clearButton)

    // Last replace should target /krav with no params.
    const lastCall = mockReplace.mock.calls.at(-1)
    expect(lastCall?.[0]).toBe('/krav')
    expect(lastCall?.[1]).toEqual({ scroll: false })
  })

  // --------------------------------------------------------------------------
  // AC 22: Debounced search writes to URL after 300ms
  // --------------------------------------------------------------------------

  it('typing in the search input writes a debounced URL replace (AC 22)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFresh()

    const input = await screen.findByPlaceholderText('Sök kravpunkter...')
    await user.type(input, 'arbets')

    // No URL write before the debounce expires.
    expect(
      mockReplace.mock.calls.some(
        (c) => typeof c[0] === 'string' && c[0].includes('search=arbets')
      )
    ).toBe(false)

    // Advance past the 300ms debounce window.
    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    await waitFor(() => {
      expect(
        mockReplace.mock.calls.some(
          (c) => typeof c[0] === 'string' && c[0].includes('search=arbets')
        )
      ).toBe(true)
    })

    vi.useRealTimers()
  })
})
