/**
 * Story 25.4 v0.6 (Epic 25, B.4 polish round): tests for <LawListPreview>.
 *
 * Five tests covering the three render states + happy path + the
 * "expand first non-empty group by position" rule.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import useSWR from 'swr'
vi.mock('swr', () => ({ default: vi.fn() }))
const mockUseSWR = vi.mocked(useSWR)

function setSwr(
  result: Partial<{
    data: unknown
    error: unknown
    isLoading: boolean
  }>
) {
  mockUseSWR.mockReturnValue({
    data: result.data,
    error: result.error,
    isLoading: result.isLoading ?? false,
    mutate: vi.fn(),
    isValidating: false,
  } as ReturnType<typeof useSWR>)
}

import { LawListPreview } from '@/components/features/onboarding-modal/law-list-preview'

describe('<LawListPreview>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton when SWR is loading (no data yet)', () => {
    setSwr({ isLoading: true, data: undefined })
    render(<LawListPreview />)

    expect(screen.getByTestId('law-list-preview-skeleton')).toBeInTheDocument()
    // Real toolbar should not render in skeleton state.
    expect(screen.queryByText(/Sök i laglistan/)).not.toBeInTheDocument()
  })

  it('renders graceful empty card when SWR returns error', () => {
    setSwr({ error: new Error('Preview fetch failed: 500') })
    render(<LawListPreview />)

    expect(
      screen.getByText('Förhandsvisningen är inte tillgänglig just nu.')
    ).toBeInTheDocument()
    // No skeleton + no real toolbar.
    expect(
      screen.queryByTestId('law-list-preview-skeleton')
    ).not.toBeInTheDocument()
  })

  it('renders "Förbereder förhandsvisning…" placeholder when groups[] is empty (DB write-lag)', () => {
    setSwr({
      data: {
        listId: 'list-1',
        totalItems: 0,
        groups: [],
        expandedGroup: null,
      },
    })
    render(<LawListPreview />)

    expect(screen.getByText('Förbereder förhandsvisning…')).toBeInTheDocument()
    // Toolbar still renders with 0 count.
    expect(screen.getByText('0 regelverk')).toBeInTheDocument()
  })

  it('renders toolbar pills + expanded group with items + collapsed group headers from real data', () => {
    setSwr({
      data: {
        listId: 'list-1',
        totalItems: 47,
        groups: [
          { id: 'g1', name: 'Arbetsmiljö', itemCount: 26, position: 1 },
          { id: 'g2', name: 'Miljö & Kemikalier', itemCount: 9, position: 2 },
          { id: 'g3', name: 'Brandskydd', itemCount: 9, position: 3 },
        ],
        expandedGroup: {
          id: 'g1',
          items: [
            {
              id: 'i1',
              title: 'Arbetsmiljölag (1977:1160)',
              businessContext:
                'Ni omfattas som arbetsgivare inom hotellbranschen med 12 anställda — lagen rör era köks- och serveringsprocesser.',
            },
            {
              id: 'i2',
              title: 'AFS 2020:1 — Arbetsplatsens utformning',
              businessContext: null,
            },
            {
              id: 'i3',
              title: 'AFS 2015:4 — Organisatorisk och social arbetsmiljö',
              businessContext: 'Skyldighet att arbeta med psykosocial miljö.',
            },
          ],
        },
      },
    })
    render(<LawListPreview />)

    // Toolbar
    expect(screen.getByText('47 regelverk')).toBeInTheDocument()
    expect(screen.getByText('3 områden')).toBeInTheDocument()

    // Expanded group header
    expect(screen.getByText('Arbetsmiljö')).toBeInTheDocument()

    // Three rows from the expanded group
    expect(screen.getByText('Arbetsmiljölag (1977:1160)')).toBeInTheDocument()
    expect(
      screen.getByText('AFS 2020:1 — Arbetsplatsens utformning')
    ).toBeInTheDocument()
    expect(
      screen.getByText('AFS 2015:4 — Organisatorisk och social arbetsmiljö')
    ).toBeInTheDocument()
    // businessContext snippet renders + gets truncated/cleaned
    expect(
      screen.getByText(/Ni omfattas som arbetsgivare inom hotellbranschen/)
    ).toBeInTheDocument()

    // All 3 groups fit within MAX_PREVIEW_GROUPS=5 → both collapsed groups
    // render, no truncation footer.
    expect(screen.getByText('Miljö & Kemikalier')).toBeInTheDocument()
    expect(screen.getByText('Brandskydd')).toBeInTheDocument()
    expect(screen.queryByText(/områden till/)).not.toBeInTheDocument()
  })

  it('caps the preview at 5 visible groups and shows "+N områden till" footer when truncated', () => {
    // 10 groups total — 1 expanded + 4 collapsed visible + 5 hidden.
    setSwr({
      data: {
        listId: 'list-1',
        totalItems: 78,
        groups: [
          { id: 'g1', name: 'Bolagsrätt', itemCount: 3, position: 1 },
          { id: 'g2', name: 'Arbetsrätt', itemCount: 17, position: 2 },
          { id: 'g3', name: 'Skatt & Redovisning', itemCount: 4, position: 3 },
          { id: 'g4', name: 'Arbetsmiljö', itemCount: 27, position: 4 },
          {
            id: 'g5',
            name: 'Brandskydd & Säkerhet',
            itemCount: 6,
            position: 5,
          },
          { id: 'g6', name: 'Fastighet & Byggnad', itemCount: 8, position: 6 },
          { id: 'g7', name: 'Livsmedel & Alkohol', itemCount: 4, position: 7 },
          { id: 'g8', name: 'Dataskydd', itemCount: 3, position: 8 },
          { id: 'g9', name: 'Miljö & Hållbarhet', itemCount: 4, position: 9 },
          { id: 'g10', name: 'Konsumenträtt', itemCount: 2, position: 10 },
        ],
        expandedGroup: {
          id: 'g1',
          items: [
            {
              id: 'i1',
              title: 'Aktiebolagslag (2005:551)',
              businessContext: null,
            },
          ],
        },
      },
    })
    render(<LawListPreview />)

    // First 4 collapsed groups (positions 2-5) render alongside the expanded
    // first group (position 1).
    expect(screen.getByText('Arbetsrätt')).toBeInTheDocument()
    expect(screen.getByText('Skatt & Redovisning')).toBeInTheDocument()
    expect(screen.getByText('Arbetsmiljö')).toBeInTheDocument()
    expect(screen.getByText('Brandskydd & Säkerhet')).toBeInTheDocument()

    // Groups beyond position 5 are NOT rendered as headers.
    expect(screen.queryByText('Fastighet & Byggnad')).not.toBeInTheDocument()
    expect(screen.queryByText('Konsumenträtt')).not.toBeInTheDocument()

    // Footer shows the new shorter copy without "på /laglistor".
    expect(screen.getByText(/\+5 områden till/)).toBeInTheDocument()
    expect(screen.queryByText(/på \/laglistor/)).not.toBeInTheDocument()
  })

  it('expands the first group with itemCount > 0 by position (LLM order), skipping empty groups', () => {
    // First group by position is empty; second has items. The API
    // is responsible for picking the right expandedGroup, and this test
    // verifies the component honors whichever group the API marked
    // expandedGroup — it does NOT re-sort or re-pick client-side.
    setSwr({
      data: {
        listId: 'list-1',
        totalItems: 10,
        groups: [
          { id: 'g1', name: 'Övrigt', itemCount: 0, position: 1 },
          { id: 'g2', name: 'Arbetsrätt', itemCount: 10, position: 2 },
        ],
        expandedGroup: {
          id: 'g2',
          items: [
            {
              id: 'i1',
              title: 'Lagen (1982:80) om anställningsskydd',
              businessContext: null,
            },
          ],
        },
      },
    })
    render(<LawListPreview />)

    // Arbetsrätt is expanded (not Övrigt) — its item renders inline.
    expect(
      screen.getByText('Lagen (1982:80) om anställningsskydd')
    ).toBeInTheDocument()
    // Both group names appear (Övrigt as collapsed header, Arbetsrätt as expanded header).
    expect(screen.getByText('Övrigt')).toBeInTheDocument()
    expect(screen.getByText('Arbetsrätt')).toBeInTheDocument()
  })
})
