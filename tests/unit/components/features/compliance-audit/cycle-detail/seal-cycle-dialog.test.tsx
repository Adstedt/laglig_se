/**
 * Story 21.9 — SealCycleDialog component tests (AC 14).
 * Updated 2026-04-24 for the surfaced-avvikelser UX change: dialog now
 * receives the actual open AVVIKELSE rows (id/title/severity/contextLabel)
 * rather than just a count.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import {
  SealCycleDialog,
  type OpenAvvikelseSummary,
  type DraftDocumentSummary,
} from '@/components/features/compliance-audit/cycle-detail/seal-cycle-dialog'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

function makeAvvikelse(
  overrides: Partial<OpenAvvikelseSummary> = {}
): OpenAvvikelseSummary {
  return {
    id: 'finding-1',
    title: 'Saknar dokumentation för rutin A',
    severity: 'MINOR',
    contextLabel: 'AFS 2001:1 Systematiskt arbetsmiljöarbete',
    ...overrides,
  }
}

function renderDialog(
  overrides: {
    open?: boolean
    isSubmitting?: boolean
    openAvvikelser?: OpenAvvikelseSummary[]
    draftDocuments?: DraftDocumentSummary[]
    pendingTasks?: number
  } = {}
) {
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  const result = render(
    <SealCycleDialog
      open={overrides.open ?? true}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      isSubmitting={overrides.isSubmitting ?? false}
      openAvvikelser={overrides.openAvvikelser ?? []}
      draftDocuments={overrides.draftDocuments ?? []}
      pendingTasks={overrides.pendingTasks ?? 0}
    />
  )
  return { ...result, onConfirm, onOpenChange }
}

function makeDraftDoc(
  overrides: Partial<DraftDocumentSummary> = {}
): DraftDocumentSummary {
  return {
    id: 'draft-1',
    title: 'Brandskyddsrutin v3 (utkast)',
    contextLabel: 'AFS 2007:5 Tillfälliga personlyft',
    ...overrides,
  }
}

describe('SealCycleDialog', () => {
  it('closed by default when open=false', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('Fastställ kontrollen?')).toBeNull()
  })

  it('renders title + three base paragraphs (post-rewrite copy)', () => {
    renderDialog()
    expect(screen.getByText('Fastställ kontrollen?')).toBeInTheDocument()
    expect(
      screen.getByText(
        /När du fastställer låses kontrollens resultat\. Samtidigt skapas en unik kontrollsumma/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Dokument, motiveringar och anmärkningar låses\. Bevisfilerna skyddas mot oavsiktlig radering/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Fastställandet går inte att ångra.')
    ).toBeInTheDocument()
  })

  it('no open avvikelser → advisory panel NOT rendered; primary enabled after typing FASTSTÄLL', () => {
    renderDialog({ openAvvikelser: [], pendingTasks: 0 })
    expect(
      screen.queryByLabelText(/Motivera varför kontrollen fastställs/)
    ).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    const primary = screen.getByRole('button', { name: /Fastställ kontroll/ })
    // Primary stays disabled until the type-to-confirm phrase is typed —
    // every seal requires this final friction gate.
    expect(primary).toBeDisabled()

    const confirmInput = screen.getByLabelText(/Skriv .* för att bekräfta/)
    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })
    expect(primary).not.toBeDisabled()
  })

  it('1 open avvikelse → singular Swedish ("Du har 1 öppen avvikelse"), title surfaced, MINOR badge', () => {
    renderDialog({
      openAvvikelser: [
        makeAvvikelse({
          title: 'Saknar dokumentation för rutin A',
          severity: 'MINOR',
        }),
      ],
    })
    // The avvikelse panel renders only the heading + list; the "Fastställande
    // kräver..." copy + textarea + label live in the extracted
    // OverrideMotiveringTextarea (shared with the drafts panel as of v0.5).
    const warning = screen.getByRole('alert')
    expect(warning.textContent).toMatch(/Du har 1 öppen avvikelse/)
    // Panel uses singular "öppen avvikelse" — assert the panel doesn't
    // render the plural form. (The shared label below the panel always
    // uses plural, so we scope this assertion to the panel.)
    expect(warning.textContent).not.toMatch(/Du har \d+ öppna avvikelser/)
    // Title surfaced as a list item:
    expect(
      screen.getByText('Saknar dokumentation för rutin A')
    ).toBeInTheDocument()
    // Severity badge with Swedish-friendly aria-label:
    expect(screen.getByLabelText('Severitet: MINOR')).toBeInTheDocument()
    // Single-avvikelse label variant in the shared textarea:
    expect(
      screen.getByLabelText(
        /Motivera varför kontrollen fastställs trots öppen avvikelse/
      )
    ).toBeInTheDocument()
  })

  it('multiple open avvikelser → plural Swedish + each title rendered + "gemensam motivering" copy', () => {
    renderDialog({
      openAvvikelser: [
        makeAvvikelse({
          id: 'f1',
          title: 'Avvikelse A',
          severity: 'MAJOR',
        }),
        makeAvvikelse({
          id: 'f2',
          title: 'Avvikelse B',
          severity: 'MINOR',
        }),
        makeAvvikelse({
          id: 'f3',
          title: 'Avvikelse C',
          severity: null,
        }),
      ],
    })
    const warning = screen.getByRole('alert')
    expect(warning.textContent).toMatch(/Du har 3 öppna avvikelser/)
    expect(screen.getByText('Avvikelse A')).toBeInTheDocument()
    expect(screen.getByText('Avvikelse B')).toBeInTheDocument()
    expect(screen.getByText('Avvikelse C')).toBeInTheDocument()
    expect(screen.getByLabelText('Severitet: MAJOR')).toBeInTheDocument()
    expect(screen.getByLabelText('Severitet: MINOR')).toBeInTheDocument()
    expect(screen.getByLabelText('Severitet: —')).toBeInTheDocument() // null severity
    // Plural-avvikelse label variant in the shared override textarea (v0.5
    // extracted the textarea + label out of the panel into a shared component).
    expect(
      screen.getByLabelText(
        /Motivera varför kontrollen fastställs trots öppna avvikelser/
      )
    ).toBeInTheDocument()
  })

  it('appends pendingTasks clause when > 0', () => {
    renderDialog({
      openAvvikelser: [makeAvvikelse()],
      pendingTasks: 3,
    })
    const warning = screen.getByRole('alert')
    expect(warning.textContent).toMatch(
      /Du har 1 öppen avvikelse med 3 pågående åtgärdsuppgifter/
    )
  })

  it('omits pendingTasks clause when === 0', () => {
    renderDialog({ openAvvikelser: [makeAvvikelse()], pendingTasks: 0 })
    const warning = screen.getByRole('alert')
    expect(warning.textContent).not.toMatch(/pågående åtgärdsuppgifter/)
  })

  it('renders contextLabel after the avvikelse title when provided', () => {
    renderDialog({
      openAvvikelser: [
        makeAvvikelse({
          title: 'Saknar rutin',
          contextLabel: 'AFS 2001:1 Systematiskt arbetsmiljöarbete',
        }),
      ],
    })
    expect(
      screen.getByText(/AFS 2001:1 Systematiskt arbetsmiljöarbete/)
    ).toBeInTheDocument()
  })

  it('omits contextLabel suffix when null (cycle-level avvikelse)', () => {
    renderDialog({
      openAvvikelser: [
        makeAvvikelse({ title: 'Cykel-nivå avvikelse', contextLabel: null }),
      ],
    })
    const warning = screen.getByRole('alert')
    expect(warning.textContent).toContain('Cykel-nivå avvikelse')
    // No "·" separator should appear since contextLabel is null
    expect(warning.textContent).not.toMatch(/Cykel-nivå avvikelse · /)
  })

  // ---------- v0.5: DRAFT styrdokument panel ----------

  it('v0.5: 1 draft document → renders panel with title + UTKAST badge + singular label', () => {
    renderDialog({
      draftDocuments: [makeDraftDoc({ title: 'Brandskyddsrutin v3' })],
    })
    // Panel rendered + title surfaced.
    expect(document.body.textContent).toMatch(
      /Du har 1 styrdokument i utkast-status/
    )
    expect(screen.getByText('Brandskyddsrutin v3')).toBeInTheDocument()
    expect(screen.getByLabelText('Status: utkast')).toBeInTheDocument()

    // Shared override textarea is rendered with singular Swedish.
    expect(
      screen.getByLabelText(
        /Motivera varför kontrollen fastställs trots ett utkast-styrdokument/
      )
    ).toBeInTheDocument()
  })

  it('v0.5: multiple draft documents → plural Swedish + each title rendered', () => {
    renderDialog({
      draftDocuments: [
        makeDraftDoc({ id: 'd1', title: 'Doc A' }),
        makeDraftDoc({ id: 'd2', title: 'Doc B' }),
        makeDraftDoc({ id: 'd3', title: 'Doc C' }),
      ],
    })
    expect(document.body.textContent).toMatch(
      /Du har 3 styrdokument i utkast-status/
    )
    expect(screen.getByText('Doc A')).toBeInTheDocument()
    expect(screen.getByText('Doc B')).toBeInTheDocument()
    expect(screen.getByText('Doc C')).toBeInTheDocument()
    // Plural label.
    expect(
      screen.getByLabelText(
        /Motivera varför kontrollen fastställs trots utkast-styrdokument/
      )
    ).toBeInTheDocument()
  })

  it('v0.5: combined blockers (avvikelse + drafts) → BOTH panels + "gemensam" label', () => {
    renderDialog({
      openAvvikelser: [makeAvvikelse({ title: 'Saknar dokumentation' })],
      draftDocuments: [makeDraftDoc({ title: 'Brandskyddsrutin v3' })],
    })
    // Both lists surface.
    expect(screen.getByText('Saknar dokumentation')).toBeInTheDocument()
    expect(screen.getByText('Brandskyddsrutin v3')).toBeInTheDocument()
    // Shared label uses "Gemensam" + cites BOTH categories.
    expect(
      screen.getByLabelText(
        /Motivera varför kontrollen fastställs trots öppen avvikelse och ett utkast-styrdokument/
      )
    ).toBeInTheDocument()
    // Single override textarea — by id (the dialog has only one
    // `seal-override-reason` regardless of how many blockers exist).
    expect(
      document.querySelectorAll('textarea#seal-override-reason')
    ).toHaveLength(1)
  })

  it('v0.5: drafts-only override unlocks primary button after motivering + FASTSTÄLL', () => {
    const { onConfirm } = renderDialog({
      draftDocuments: [makeDraftDoc()],
    })
    const textarea = screen.getByLabelText(
      /Motivera varför kontrollen fastställs/
    )
    const confirmInput = screen.getByLabelText(/Skriv .* för att bekräfta/)
    const primary = screen.getByRole('button', { name: /Fastställ kontroll/ })

    // Empty → disabled
    expect(primary).toBeDisabled()

    fireEvent.change(textarea, {
      target: {
        value: 'Utkast accepteras inför Q1-handover; godkänns formellt v.18.',
      },
    })
    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })
    expect(primary).not.toBeDisabled()

    fireEvent.click(primary)
    expect(onConfirm).toHaveBeenCalledWith(
      'Utkast accepteras inför Q1-handover; godkänns formellt v.18.'
    )
  })

  it('override case: textarea threshold AND confirm-phrase both gate primary', () => {
    renderDialog({ openAvvikelser: [makeAvvikelse()] })
    const textarea = screen.getByLabelText(
      /Motivera varför kontrollen fastställs/
    )
    const confirmInput = screen.getByLabelText(/Skriv .* för att bekräfta/)
    const primary = screen.getByRole('button', { name: /Fastställ kontroll/ })

    // Both empty → disabled
    expect(primary).toBeDisabled()

    // 19 chars motivering, no confirm → still disabled
    fireEvent.change(textarea, { target: { value: 'a'.repeat(19) } })
    expect(primary).toBeDisabled()

    // 20 chars motivering, no confirm → still disabled (confirm gate)
    fireEvent.change(textarea, { target: { value: 'a'.repeat(20) } })
    expect(primary).toBeDisabled()

    // 20 chars motivering, partial confirm "FAST" → still disabled
    fireEvent.change(confirmInput, { target: { value: 'FAST' } })
    expect(primary).toBeDisabled()

    // 20 chars motivering, full confirm "FASTSTÄLL" → ENABLED
    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })
    expect(primary).not.toBeDisabled()

    // Reduce motivering back below threshold → disabled again (motivering gate)
    fireEvent.change(textarea, { target: { value: 'a'.repeat(19) } })
    expect(primary).toBeDisabled()
  })

  it('counter copy: below threshold shows countdown, at/above shows confirmation', () => {
    renderDialog({ openAvvikelser: [makeAvvikelse()] })
    const textarea = screen.getByLabelText(
      /Motivera varför kontrollen fastställs/
    )
    // Radix Dialog renders into a portal — query against document.body, not the
    // React-rendered container.
    const allText = () => document.body.textContent ?? ''

    // 0 chars (initial) → "0 / 20 tecken"
    expect(allText()).toContain('0 / 20 tecken')

    // 12 chars → still in countdown
    fireEvent.change(textarea, { target: { value: 'a'.repeat(12) } })
    expect(allText()).toContain('12 / 20 tecken')

    // 20 chars → flips to confirmation copy + drops the / 20 denominator
    fireEvent.change(textarea, { target: { value: 'a'.repeat(20) } })
    expect(allText()).toContain('Tillräckligt långt (20 tecken)')
    expect(allText()).not.toContain('20 / 20 tecken')

    // 74 chars (well past threshold) → still confirmation, not "74 / 20"
    fireEvent.change(textarea, { target: { value: 'a'.repeat(74) } })
    expect(allText()).toContain('Tillräckligt långt (74 tecken)')
    expect(allText()).not.toContain('74 / 20')
  })

  it('Swedish singular grammar: "öppen avvikelse" for 1, "öppna avvikelser" for many', () => {
    const { rerender } = render(
      <SealCycleDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={false}
        openAvvikelser={[makeAvvikelse()]}
        draftDocuments={[]}
        pendingTasks={0}
      />
    )
    // Radix Dialog content lives in a portal — read from document.body.
    expect(document.body.textContent).toMatch(/trots öppen avvikelse/)
    expect(document.body.textContent).not.toMatch(/trots öppna avvikelse\b/)

    rerender(
      <SealCycleDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={false}
        openAvvikelser={[
          makeAvvikelse({ id: 'a' }),
          makeAvvikelse({ id: 'b' }),
        ]}
        draftDocuments={[]}
        pendingTasks={0}
      />
    )
    expect(document.body.textContent).toMatch(/trots öppna avvikelser/)
  })

  it('type-to-confirm: case-sensitive — "fastställ" lowercase does NOT enable primary', () => {
    renderDialog({ openAvvikelser: [] })
    const confirmInput = screen.getByLabelText(/Skriv .* för att bekräfta/)
    const primary = screen.getByRole('button', { name: /Fastställ kontroll/ })

    fireEvent.change(confirmInput, { target: { value: 'fastställ' } })
    expect(primary).toBeDisabled()

    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })
    expect(primary).not.toBeDisabled()
  })

  it('type-to-confirm: confirm-text resets when dialog closed → reopened', () => {
    const { rerender } = render(
      <SealCycleDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={false}
        openAvvikelser={[]}
        draftDocuments={[]}
        pendingTasks={0}
      />
    )
    const confirmInput = screen.getByLabelText(
      /Skriv .* för att bekräfta/
    ) as HTMLInputElement
    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })
    expect(confirmInput.value).toBe('FASTSTÄLL')

    rerender(
      <SealCycleDialog
        open={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={false}
        openAvvikelser={[]}
        draftDocuments={[]}
        pendingTasks={0}
      />
    )
    rerender(
      <SealCycleDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={false}
        openAvvikelser={[]}
        draftDocuments={[]}
        pendingTasks={0}
      />
    )
    const reopened = screen.getByLabelText(
      /Skriv .* för att bekräfta/
    ) as HTMLInputElement
    expect(reopened.value).toBe('')
  })

  it('type-to-confirm: aria-invalid only fires when text is wrong + non-empty', () => {
    renderDialog({ openAvvikelser: [] })
    const confirmInput = screen.getByLabelText(
      /Skriv .* för att bekräfta/
    ) as HTMLInputElement

    // Empty → no error signal
    expect(confirmInput).not.toHaveAttribute('aria-invalid', 'true')

    // Partial / wrong → invalid
    fireEvent.change(confirmInput, { target: { value: 'FAST' } })
    expect(confirmInput).toHaveAttribute('aria-invalid', 'true')

    // Correct → valid
    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })
    expect(confirmInput).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('aria-invalid is false when textarea is empty (not yet a real error state)', () => {
    renderDialog({ openAvvikelser: [makeAvvikelse()] })
    const textarea = screen.getByLabelText(
      /Motivera varför kontrollen fastställs/
    ) as HTMLTextAreaElement
    // Empty input shouldn't render as invalid — that's noisy on first paint.
    expect(textarea).not.toHaveAttribute('aria-invalid', 'true')

    // Type some chars but stay below threshold → THEN show invalid signal
    fireEvent.change(textarea, { target: { value: 'short' } })
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
  })

  it('primary click with override → onConfirm called with trimmed string', () => {
    const { onConfirm } = renderDialog({
      openAvvikelser: [makeAvvikelse()],
    })
    const textarea = screen.getByLabelText(
      /Motivera varför kontrollen fastställs/
    )
    const confirmInput = screen.getByLabelText(/Skriv .* för att bekräfta/)
    const primary = screen.getByRole('button', { name: /Fastställ kontroll/ })
    const padded = '   ' + 'a'.repeat(25) + '   '
    fireEvent.change(textarea, { target: { value: padded } })
    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })
    fireEvent.click(primary)
    expect(onConfirm).toHaveBeenCalledWith('a'.repeat(25))
  })

  it('primary click with no open avvikelser → onConfirm called with undefined', () => {
    const { onConfirm } = renderDialog({ openAvvikelser: [] })
    const confirmInput = screen.getByLabelText(/Skriv .* för att bekräfta/)
    const primary = screen.getByRole('button', { name: /Fastställ kontroll/ })
    fireEvent.change(confirmInput, { target: { value: 'FASTSTÄLL' } })
    fireEvent.click(primary)
    expect(onConfirm).toHaveBeenCalledWith(undefined)
  })

  it('Cancel click → onOpenChange(false)', () => {
    const { onOpenChange } = renderDialog()
    const cancel = screen.getByRole('button', { name: 'Avbryt' })
    fireEvent.click(cancel)
    expect(onOpenChange).toHaveBeenCalled()
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false)
  })

  it('isSubmitting=true → primary shows spinner + both buttons disabled', () => {
    renderDialog({ isSubmitting: true })
    const primary = screen.getByRole('button', { name: /Fastställ kontroll/ })
    const cancel = screen.getByRole('button', { name: 'Avbryt' })
    expect(primary).toBeDisabled()
    expect(cancel).toBeDisabled()
    const spinner = primary.querySelector('.animate-spin')
    expect(spinner).not.toBeNull()
  })

  it('textarea resets when dialog closed → reopened', () => {
    const { rerender } = render(
      <SealCycleDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={false}
        openAvvikelser={[makeAvvikelse()]}
        draftDocuments={[]}
        pendingTasks={0}
      />
    )
    const textarea = screen.getByLabelText(
      /Motivera varför kontrollen fastställs/
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: { value: 'some initial text value ok' },
    })
    expect(textarea.value).toBe('some initial text value ok')

    rerender(
      <SealCycleDialog
        open={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={false}
        openAvvikelser={[makeAvvikelse()]}
        draftDocuments={[]}
        pendingTasks={0}
      />
    )
    rerender(
      <SealCycleDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isSubmitting={false}
        openAvvikelser={[makeAvvikelse()]}
        draftDocuments={[]}
        pendingTasks={0}
      />
    )
    const reopened = screen.getByLabelText(
      /Motivera varför kontrollen fastställs/
    ) as HTMLTextAreaElement
    expect(reopened.value).toBe('')
  })
})
