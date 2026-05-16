/**
 * Story 25.0 / 25.1 (Epic 25): component test for <PathChoiceStep>.
 *
 * B.1 + post-25.1 polish: four cards (Mall / Generera / Tom lista / Importera).
 * Mall + Importera hand off to the parent via callback props; Generera + Tom
 * lista fire their own server actions and close the modal directly.
 *
 * The "Hoppa över guiden" skip link is owned by the modal-shell footer
 * post-polish — tests for it live in first-run-modal.test.tsx.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}))

const mockMinimise = vi.fn().mockResolvedValue({ ok: true })
const mockRecordEvent = vi.fn().mockResolvedValue({ ok: true })
vi.mock('@/app/actions/onboarding-modal', () => ({
  minimiseFirstRunModal: () => mockMinimise(),
  // skipLawListGeneration is no longer called from PathChoiceStep — moved
  // to the modal-shell footer. Provide a no-op so any stray import path
  // resolution doesn't break.
  skipLawListGeneration: vi.fn().mockResolvedValue({ ok: true }),
  recordOnboardingEvent: (...args: unknown[]) => mockRecordEvent(...args),
}))

import { PathChoiceStep } from '@/components/features/onboarding-modal/path-choice-step'
import { toast } from 'sonner'

function renderStep(
  overrides: Partial<{
    onClose: () => void
    onPickTemplate: () => void
    onPickImport: () => void
  }> = {}
) {
  const props = {
    onClose: vi.fn(),
    onPickTemplate: vi.fn(),
    onPickImport: vi.fn(),
    ...overrides,
  }
  render(<PathChoiceStep {...props} />)
  return props
}

describe('<PathChoiceStep>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all four cards', () => {
    renderStep()

    expect(
      screen.getByRole('button', { name: /Börja från mall/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Generera ny lista/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Tom lista/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Importera befintlig/ })
    ).toBeInTheDocument()
  })

  it('Importera card is active in B.1 — no aria-disabled, no Kommer snart badge', () => {
    renderStep()

    const importCard = screen.getByRole('button', {
      name: /Importera befintlig/,
    })
    expect(importCard).not.toHaveAttribute('aria-disabled', 'true')
    expect(importCard.className).not.toContain('cursor-not-allowed')
    expect(importCard.className).not.toContain('opacity-60')
    expect(screen.queryByText('Kommer snart')).not.toBeInTheDocument()
  })

  it('Mall card → records path_chosen=template and calls onPickTemplate; does NOT minimise or route', async () => {
    const onPickTemplate = vi.fn()
    const onClose = vi.fn()
    renderStep({ onClose, onPickTemplate })

    fireEvent.click(screen.getByRole('button', { name: /Börja från mall/ }))

    await waitFor(() => {
      expect(mockRecordEvent).toHaveBeenCalledWith('path_chosen', {
        path: 'template',
      })
    })
    expect(onPickTemplate).toHaveBeenCalled()
    // Mall card in B.1 only signals intent — minimise + close + route are deferred
    expect(mockMinimise).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('Generera card → fires POST, records path_chosen=generate, minimises, closes', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))
    const onClose = vi.fn()
    renderStep({ onClose })

    fireEvent.click(screen.getByRole('button', { name: /Generera ny lista/ }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/workspace/generate-law-list',
        {
          method: 'POST',
        }
      )
    })
    await waitFor(() => {
      expect(mockRecordEvent).toHaveBeenCalledWith('path_chosen', {
        path: 'generate',
      })
    })
    await waitFor(() => {
      expect(mockMinimise).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })

    fetchSpy.mockRestore()
  })

  it('Generera 409 (already in progress) → treat as success: close + minimise but do NOT record duplicate path_chosen', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 409 }))
    const onClose = vi.fn()
    renderStep({ onClose })

    fireEvent.click(screen.getByRole('button', { name: /Generera ny lista/ }))

    await waitFor(() => {
      expect(mockMinimise).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
    // 409 means generation is already running — re-recording path_chosen would
    // double-count the funnel.
    expect(mockRecordEvent).not.toHaveBeenCalledWith('path_chosen', {
      path: 'generate',
    })
    expect(toast.error).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('Generera fetch failure → toast.error, modal stays open, no path_chosen event', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 500 }))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onClose = vi.fn()
    renderStep({ onClose })

    fireEvent.click(screen.getByRole('button', { name: /Generera ny lista/ }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Något gick fel. Försök igen.')
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(mockMinimise).not.toHaveBeenCalled()
    expect(mockRecordEvent).not.toHaveBeenCalledWith('path_chosen', {
      path: 'generate',
    })

    fetchSpy.mockRestore()
    errSpy.mockRestore()
  })

  it('Importera card → records path_chosen=import and calls onPickImport; no toast, no minimise', async () => {
    const onPickImport = vi.fn()
    const onClose = vi.fn()
    renderStep({ onClose, onPickImport })

    fireEvent.click(screen.getByRole('button', { name: /Importera befintlig/ }))

    await waitFor(() => {
      expect(mockRecordEvent).toHaveBeenCalledWith('path_chosen', {
        path: 'import',
      })
    })
    expect(onPickImport).toHaveBeenCalled()
    // B.1: no toast, no minimise on Importera click — that happens on upload success
    expect(toast.info).not.toHaveBeenCalled()
    expect(mockMinimise).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Tom lista card → records path_chosen=manual, minimises, closes, routes to /laglistor', async () => {
    const onClose = vi.fn()
    renderStep({ onClose })

    fireEvent.click(screen.getByRole('button', { name: /Tom lista/ }))

    await waitFor(() => {
      expect(mockRecordEvent).toHaveBeenCalledWith('path_chosen', {
        path: 'manual',
      })
    })
    await waitFor(() => {
      expect(mockMinimise).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
    expect(mockPush).toHaveBeenCalledWith('/laglistor')
  })

  it('Tom lista card → if minimise fails, toasts and does NOT close or route (QA ROBUST-001)', async () => {
    mockMinimise.mockResolvedValueOnce({
      ok: false,
      error: 'Kunde inte stänga guiden.',
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onClose = vi.fn()
    renderStep({ onClose })

    fireEvent.click(screen.getByRole('button', { name: /Tom lista/ }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Något gick fel. Försök igen.')
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()

    errSpy.mockRestore()
  })

  // Note: "Hoppa över guiden" skip tests moved to first-run-modal.test.tsx
  // because the skip button now lives in the modal-shell footer post-polish.
})
