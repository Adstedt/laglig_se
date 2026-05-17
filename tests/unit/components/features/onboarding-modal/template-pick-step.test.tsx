/**
 * Story 25.1 (Epic 25): component test for <TemplatePickStep>.
 * Story 25.4 (B.4): updated for the inline-apply pivot — template selection
 * now calls adoptTemplate server-side and bubbles the result via
 * onTemplateApplied (instead of minimise + close + route to /mallar/{slug}).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))

const mockRecordEvent = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/actions/onboarding-modal', () => ({
  recordOnboardingEvent: (...args: unknown[]) => mockRecordEvent(...args),
}))

// Story 25.4: control adoptTemplate's resolution from each test.
const mockAdoptTemplate = vi.fn()
vi.mock('@/app/actions/template-adoption', () => ({
  adoptTemplate: (input: unknown) => mockAdoptTemplate(input),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}))

import { TemplatePickStep } from '@/components/features/onboarding-modal/template-pick-step'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

function template(
  overrides: Partial<PublishedTemplate> = {}
): PublishedTemplate {
  return {
    id: 'tpl-1',
    name: 'Bygg & anläggning',
    slug: 'bygg-anlaggning',
    description: 'Branschstartpunkt för bygg- och anläggningsbranschen.',
    domain: 'BYGG',
    target_audience: 'KONTOR',
    document_count: 92,
    section_count: 11,
    primary_regulatory_bodies: ['AV', 'NV'],
    is_variant: false,
    variants: [],
    ...overrides,
  }
}

describe('<TemplatePickStep>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: adoptTemplate succeeds.
    mockAdoptTemplate.mockResolvedValue({
      success: true,
      data: {
        listId: 'list-applied-1',
        listName: 'Applied: Bygg',
        itemCount: 92,
      },
    })
  })

  it('renders one card per template + a Tillbaka button', () => {
    const templates = [
      template({ id: 't1', name: 'Bygg', slug: 'bygg' }),
      template({ id: 't2', name: 'Industri', slug: 'industri' }),
      template({ id: 't3', name: 'Service', slug: 'service' }),
    ]

    render(
      <TemplatePickStep
        templates={templates}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onTemplateApplied={vi.fn()}
      />
    )

    expect(screen.getByText('Bygg')).toBeInTheDocument()
    expect(screen.getByText('Industri')).toBeInTheDocument()
    expect(screen.getByText('Service')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tillbaka/ })).toBeInTheDocument()
  })

  it('renders the empty-state fallback when no templates are passed', () => {
    render(
      <TemplatePickStep
        templates={[]}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onTemplateApplied={vi.fn()}
      />
    )

    expect(
      screen.getByText(/Inga publicerade mallar tillgängliga/)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tillbaka/ })).toBeInTheDocument()
  })

  it('B.4: clicking a template → calls adoptTemplate, records path_chosen with list_id, invokes onTemplateApplied (NOT router.push)', async () => {
    const onTemplateApplied = vi.fn()
    const onClose = vi.fn()
    const templates = [template({ id: 't1', name: 'Bygg', slug: 'bygg' })]

    render(
      <TemplatePickStep
        templates={templates}
        onBack={vi.fn()}
        onClose={onClose}
        onTemplateApplied={onTemplateApplied}
      />
    )

    fireEvent.click(screen.getByText('Bygg'))

    await waitFor(() => {
      expect(mockAdoptTemplate).toHaveBeenCalledWith({
        templateSlug: 'bygg',
      })
    })
    await waitFor(() => {
      expect(mockRecordEvent).toHaveBeenCalledWith('path_chosen', {
        path: 'template',
        template_slug: 'bygg',
        list_id: 'list-applied-1',
      })
    })
    await waitFor(() => {
      expect(onTemplateApplied).toHaveBeenCalledWith({
        listId: 'list-applied-1',
        listName: 'Applied: Bygg',
        itemCount: 92,
      })
    })
    // B.4 pivot: no router.push from this component (parent handles routing
    // via the done-template step's CTA).
    expect(mockPush).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('B.4: renders inline loader during apply', async () => {
    // Hold the adoptTemplate promise open so we can assert the loader.
    let resolveApply: (_v: unknown) => void = () => {}
    mockAdoptTemplate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApply = resolve
        })
    )
    const templates = [template({ id: 't1', name: 'Bygg', slug: 'bygg' })]

    render(
      <TemplatePickStep
        templates={templates}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onTemplateApplied={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Bygg'))

    await waitFor(() => {
      expect(screen.getByText(/Skapar er laglista/)).toBeInTheDocument()
    })
    // Cards are replaced by the loader.
    expect(screen.queryByText('Bygg')).not.toBeInTheDocument()

    // Resolve so the test cleans up without dangling promises.
    resolveApply({
      success: true,
      data: { listId: 'l', listName: 'L', itemCount: 0 },
    })
  })

  it('B.4: shows toast.error on adoptTemplate failure + stays mounted', async () => {
    const { toast } = await import('sonner')
    mockAdoptTemplate.mockResolvedValueOnce({
      success: false,
      error: 'Mallen kunde inte aktiveras (testfel)',
    })
    const onTemplateApplied = vi.fn()
    const templates = [template({ id: 't1', name: 'Bygg', slug: 'bygg' })]

    render(
      <TemplatePickStep
        templates={templates}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onTemplateApplied={onTemplateApplied}
      />
    )

    fireEvent.click(screen.getByText('Bygg'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Mallen kunde inte aktiveras (testfel)'
      )
    })
    // Loader cleared; cards re-rendered so the user can pick again.
    await waitFor(() => {
      expect(screen.getByText('Bygg')).toBeInTheDocument()
    })
    expect(onTemplateApplied).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('Tillbaka → calls onBack and does NOT fire any server action', () => {
    const onBack = vi.fn()
    const onClose = vi.fn()
    const onTemplateApplied = vi.fn()
    const templates = [template()]

    render(
      <TemplatePickStep
        templates={templates}
        onBack={onBack}
        onClose={onClose}
        onTemplateApplied={onTemplateApplied}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Tillbaka/ }))

    expect(onBack).toHaveBeenCalled()
    expect(mockRecordEvent).not.toHaveBeenCalled()
    expect(mockAdoptTemplate).not.toHaveBeenCalled()
    expect(onTemplateApplied).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
