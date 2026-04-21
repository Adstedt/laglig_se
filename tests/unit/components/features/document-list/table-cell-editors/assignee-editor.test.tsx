/**
 * Story 20.1: AssigneeEditor — inherited-variant a11y test.
 *
 * Verifies that when `variant="inherited"` is set, the picker exposes the
 * "Ärvd från lagansvarig" label via an accessibility-visible surface (the
 * native `title` attribute on the SelectTrigger, which doubles as the
 * Radix Tooltip content). This ensures screen-reader users learn that the
 * assignee shown is inherited rather than a direct override, satisfying AC 10.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssigneeEditor } from '@/components/features/document-list/table-cell-editors/assignee-editor'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'

const USER: WorkspaceMemberOption = {
  id: 'user-1',
  name: 'Anna Andersson',
  email: 'anna@example.se',
  avatarUrl: null,
}

describe('AssigneeEditor — inherited variant', () => {
  it('surfaces "Ärvd från lagansvarig" on the trigger for a11y', () => {
    render(
      <AssigneeEditor
        value={USER.id}
        members={[USER]}
        onChange={vi.fn().mockResolvedValue(undefined)}
        variant="inherited"
      />
    )
    // The SelectTrigger carries the Swedish inheritance tooltip text as its
    // title attribute (used both as the tooltip label and as the native
    // a11y fallback when the Radix Tooltip isn't open).
    const trigger = screen.getByTitle('Ärvd från lagansvarig')
    expect(trigger).toBeInTheDocument()
  })

  it('does NOT label the trigger as inherited when variant is direct (default)', () => {
    render(
      <AssigneeEditor
        value={USER.id}
        members={[USER]}
        onChange={vi.fn().mockResolvedValue(undefined)}
      />
    )
    expect(screen.queryByTitle('Ärvd från lagansvarig')).not.toBeInTheDocument()
  })
})

// ============================================================================
// TEST-002: Reset-option visibility + dispatch (Story 20.1 AC 12)
// ============================================================================

describe('AssigneeEditor — showResetOption', () => {
  it('renders "Återställ till lagansvarig" in the dropdown when showResetOption=true', async () => {
    const user = userEvent.setup()
    render(
      <AssigneeEditor
        value={USER.id}
        members={[USER]}
        onChange={vi.fn().mockResolvedValue(undefined)}
        showResetOption
        onResetToInherited={vi.fn()}
      />
    )
    // Radix Select renders options in a portal only after the trigger is opened.
    await user.click(screen.getByRole('combobox'))
    expect(
      await screen.findByText('Återställ till lagansvarig')
    ).toBeInTheDocument()
  })

  it('hides the reset option when showResetOption=false (default)', async () => {
    const user = userEvent.setup()
    render(
      <AssigneeEditor
        value={USER.id}
        members={[USER]}
        onChange={vi.fn().mockResolvedValue(undefined)}
        onResetToInherited={vi.fn()}
      />
    )
    await user.click(screen.getByRole('combobox'))
    // Wait for the portal content to exist (Ej tilldelad is always present).
    await screen.findByText('Ej tilldelad')
    expect(
      screen.queryByText('Återställ till lagansvarig')
    ).not.toBeInTheDocument()
  })

  it('hides the reset option when showResetOption=true but onResetToInherited is missing (defensive)', async () => {
    const user = userEvent.setup()
    render(
      <AssigneeEditor
        value={USER.id}
        members={[USER]}
        onChange={vi.fn().mockResolvedValue(undefined)}
        showResetOption
      />
    )
    await user.click(screen.getByRole('combobox'))
    await screen.findByText('Ej tilldelad')
    expect(
      screen.queryByText('Återställ till lagansvarig')
    ).not.toBeInTheDocument()
  })

  it('clicking the reset option fires onResetToInherited, NOT onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn().mockResolvedValue(undefined)
    const onResetToInherited = vi.fn().mockResolvedValue(undefined)
    render(
      <AssigneeEditor
        value={USER.id}
        members={[USER]}
        onChange={onChange}
        showResetOption
        onResetToInherited={onResetToInherited}
      />
    )
    await user.click(screen.getByRole('combobox'))
    const resetItem = await screen.findByText('Återställ till lagansvarig')
    await user.click(resetItem)

    expect(onResetToInherited).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })
})
