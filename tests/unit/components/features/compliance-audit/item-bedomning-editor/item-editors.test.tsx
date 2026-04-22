/**
 * Story 21.5 — Isolated unit tests for the three inline editor components.
 * Mounting them directly (not through CycleDetailPage) avoids happy-dom +
 * SWR + Tabs + Radix portal friction, so we can exercise the save-on-blur
 * + read-only-vs-editable contracts cleanly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { EfterlevnadsBedomning } from '@prisma/client'
import { ItemBedomningSelect } from '@/components/features/compliance-audit/item-bedomning-editor/ItemBedomningSelect'
import { ItemMotiveringEditor } from '@/components/features/compliance-audit/item-bedomning-editor/ItemMotiveringEditor'
import { ItemSignOffButton } from '@/components/features/compliance-audit/item-bedomning-editor/ItemSignOffButton'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ============================================================================
// ItemBedomningSelect
// ============================================================================

describe('ItemBedomningSelect', () => {
  it('readOnly mode renders plain badge, not a select', () => {
    render(
      <ItemBedomningSelect
        value={EfterlevnadsBedomning.UPPFYLLD}
        onChange={vi.fn()}
        readOnly
      />
    )
    // No combobox role in readOnly mode.
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('Uppfylld')).toBeInTheDocument()
  })

  it('readOnly mode renders "—" for null value', () => {
    render(<ItemBedomningSelect value={null} onChange={vi.fn()} readOnly />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('editable mode renders a combobox with aria-label "Bedömning"', () => {
    render(<ItemBedomningSelect value={null} onChange={vi.fn()} />)
    const trigger = screen.getByLabelText('Bedömning')
    expect(trigger).toBeInTheDocument()
    expect(trigger.textContent).toContain('—')
  })
})

// ============================================================================
// ItemMotiveringEditor
// ============================================================================

describe('ItemMotiveringEditor', () => {
  it('readOnly renders paragraph, no edit affordance', () => {
    render(
      <ItemMotiveringEditor
        value="Befintlig motivering"
        onChange={vi.fn()}
        readOnly
      />
    )
    expect(screen.getByText('Befintlig motivering')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Redigera motivering' })
    ).toBeNull()
  })

  it('readOnly with null shows "—"', () => {
    render(<ItemMotiveringEditor value={null} onChange={vi.fn()} readOnly />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('click-to-edit reveals a textarea + focuses it', async () => {
    render(<ItemMotiveringEditor value={null} onChange={vi.fn()} />)
    const trigger = screen.getByRole('button', {
      name: 'Redigera motivering',
    })
    fireEvent.click(trigger)
    // setTimeout(focus, 0) in enterEdit needs a tick to fire.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const textarea = screen.getByLabelText('Motivering') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
  })

  it('save-on-blur calls onChange with the trimmed value', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<ItemMotiveringEditor value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Redigera motivering' }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const textarea = screen.getByLabelText('Motivering') as HTMLTextAreaElement

    // fireEvent.blur carries the current DOM value via event.target.value,
    // so handleBlur can read it directly without needing prior state sync.
    fireEvent.blur(textarea, {
      target: { value: 'Nytt innehåll' },
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(onChange).toHaveBeenCalledWith('Nytt innehåll')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('save-on-blur skips when trimmed value matches current (idempotent)', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<ItemMotiveringEditor value="Samma text" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Redigera motivering' }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const textarea = screen.getByLabelText('Motivering') as HTMLTextAreaElement
    fireEvent.blur(textarea, { target: { value: 'Samma text' } })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('empty-string input normalises to null on save', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<ItemMotiveringEditor value="Old text" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Redigera motivering' }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    const textarea = screen.getByLabelText('Motivering') as HTMLTextAreaElement
    fireEvent.blur(textarea, { target: { value: '   ' } })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(onChange).toHaveBeenCalledWith(null)
  })
})

// ============================================================================
// ItemSignOffButton
// ============================================================================

describe('ItemSignOffButton', () => {
  it('renders "Signera" disabled when canSign=false with tooltip reason', () => {
    render(
      <ItemSignOffButton
        signedOffAt={null}
        signedOffBy={null}
        canSign={false}
        canUnsign={false}
        onSign={vi.fn()}
        onUnsign={vi.fn()}
        disabledReason="Ange bedömning innan signering"
      />
    )
    const btn = screen.getByRole('button', { name: 'Signera' })
    expect(btn).toBeDisabled()
  })

  it('renders enabled Signera button when canSign=true; click invokes onSign', () => {
    const onSign = vi.fn().mockResolvedValue(undefined)
    render(
      <ItemSignOffButton
        signedOffAt={null}
        signedOffBy={null}
        canSign={true}
        canUnsign={false}
        onSign={onSign}
        onUnsign={vi.fn()}
      />
    )
    const btn = screen.getByRole('button', { name: 'Signera' })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    expect(onSign).toHaveBeenCalledTimes(1)
  })

  it('signed state shows "Signerad" metadata + unsign X when canUnsign', () => {
    const onUnsign = vi.fn().mockResolvedValue(undefined)
    render(
      <ItemSignOffButton
        signedOffAt={new Date('2026-04-22T10:00:00Z')}
        signedOffBy={{ id: 'u1', name: 'Alice Auditor' }}
        canSign={false}
        canUnsign={true}
        onSign={vi.fn()}
        onUnsign={onUnsign}
      />
    )
    expect(screen.getByText(/Signerad/)).toBeInTheDocument()
    expect(screen.getByText(/Alice Auditor/)).toBeInTheDocument()
    const unsignBtn = screen.getByRole('button', { name: 'Ångra signering' })
    fireEvent.click(unsignBtn)
    expect(onUnsign).toHaveBeenCalledTimes(1)
  })

  it('signed state without canUnsign hides the unsign X', () => {
    render(
      <ItemSignOffButton
        signedOffAt={new Date('2026-04-22T10:00:00Z')}
        signedOffBy={{ id: 'u1', name: 'Alice Auditor' }}
        canSign={false}
        canUnsign={false}
        onSign={vi.fn()}
        onUnsign={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: 'Ångra signering' })).toBeNull()
  })
})
