/**
 * Story 25.1 (Epic 25): component test for <TemplatePickStep> — the inline
 * template-pick sub-step of the first-run modal. Exercises the render shape
 * (cards + empty fallback), the select handler (event + minimise + close +
 * route), and the Tillbaka revert (no server actions, no route).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))

const mockMinimise = vi.fn().mockResolvedValue({ ok: true })
const mockRecordEvent = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/actions/onboarding-modal', () => ({
  minimiseFirstRunModal: () => mockMinimise(),
  recordOnboardingEvent: (...args: unknown[]) => mockRecordEvent(...args),
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
      />
    )

    expect(screen.getByText('Bygg')).toBeInTheDocument()
    expect(screen.getByText('Industri')).toBeInTheDocument()
    expect(screen.getByText('Service')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tillbaka/ })).toBeInTheDocument()
  })

  it('renders the empty-state fallback when no templates are passed', () => {
    render(
      <TemplatePickStep templates={[]} onBack={vi.fn()} onClose={vi.fn()} />
    )

    expect(
      screen.getByText(/Inga publicerade mallar tillgängliga/)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tillbaka/ })).toBeInTheDocument()
  })

  it('clicking a template card → records path_chosen with slug, minimises, closes, routes', async () => {
    const onClose = vi.fn()
    const templates = [template({ id: 't1', name: 'Bygg', slug: 'bygg' })]

    render(
      <TemplatePickStep
        templates={templates}
        onBack={vi.fn()}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByText('Bygg'))

    await waitFor(() => {
      expect(mockRecordEvent).toHaveBeenCalledWith('path_chosen', {
        path: 'template',
        template_slug: 'bygg',
      })
    })
    await waitFor(() => {
      expect(mockMinimise).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
    expect(mockPush).toHaveBeenCalledWith('/laglistor/mallar/bygg')
  })

  it('clicking a template card → if minimise fails, toasts and does NOT close or route (QA ROBUST-001)', async () => {
    const { toast } = await import('sonner')
    mockMinimise.mockResolvedValueOnce({
      ok: false,
      error: 'Kunde inte stänga guiden.',
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onClose = vi.fn()
    const templates = [template({ id: 't1', name: 'Bygg', slug: 'bygg' })]

    render(
      <TemplatePickStep
        templates={templates}
        onBack={vi.fn()}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByText('Bygg'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Något gick fel. Försök igen.')
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()

    errSpy.mockRestore()
  })

  it('Tillbaka → calls onBack and does NOT fire any server action or route', () => {
    const onBack = vi.fn()
    const onClose = vi.fn()
    const templates = [template()]

    render(
      <TemplatePickStep
        templates={templates}
        onBack={onBack}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Tillbaka/ }))

    expect(onBack).toHaveBeenCalled()
    expect(mockRecordEvent).not.toHaveBeenCalled()
    expect(mockMinimise).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
