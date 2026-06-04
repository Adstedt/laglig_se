/**
 * DualStatusBadge unit tests — Story 17.17 AC 1 / AC 11 / AC 14 / CP-001.
 *
 * Covers all 5 render cases (dual / approved-only / draft-only / in-review-only /
 * archived) plus per-half anchor aria-labels, click stopPropagation, and
 * absence of raw documentId/versionId in the rendered DOM (CP-001).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DualStatusBadge } from '@/components/features/documents/dual-status-badge'

// Stub next/link so we can assert href without engaging the router.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    'aria-label': ariaLabel,
    className,
  }: {
    href: string
    children: React.ReactNode
    onClick?: (_e: React.MouseEvent) => void
    'aria-label'?: string
    className?: string
  }) => (
    <a
      href={href}
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </a>
  ),
}))

const baseProps = {
  documentId: 'doc-xyz-uuid-123',
  documentTitle: 'Arbetsmiljöpolicy',
  status: 'APPROVED',
  draftStatus: null,
  currentApprovedVersionId: null,
  currentDraftVersionId: null,
  currentApprovedVersionNumber: null,
  currentDraftVersionNumber: null,
} as const

describe('DualStatusBadge', () => {
  describe('dual state (both pointers set)', () => {
    const dualProps = {
      ...baseProps,
      status: 'APPROVED',
      draftStatus: 'DRAFT' as const,
      currentApprovedVersionId: 'v-approved',
      currentDraftVersionId: 'v-draft',
      currentApprovedVersionNumber: 3,
      currentDraftVersionNumber: 4,
    }

    it('renders both badge halves with the frozen Swedish copy', () => {
      render(<DualStatusBadge {...dualProps} />)
      expect(screen.getByText('Godkänd v3')).toBeInTheDocument()
      expect(screen.getByText('Utkast v4 pågår')).toBeInTheDocument()
    })

    it('exposes container role="status" with the full Swedish state for screen readers', () => {
      render(<DualStatusBadge {...dualProps} />)
      expect(
        screen.getByRole('status', {
          name: /Godkänd version 3, utkast version 4 pågår/,
        })
      ).toBeInTheDocument()
    })

    it('left half routes to ?view=approved with the right aria-label', () => {
      render(<DualStatusBadge {...dualProps} />)
      const approved = screen.getByRole('link', {
        name: /Öppna godkänd version 3 av Arbetsmiljöpolicy \(läsläge\)/,
      })
      expect(approved).toHaveAttribute(
        'href',
        '/workspace/styrdokument/doc-xyz-uuid-123/edit?view=approved'
      )
    })

    it('right half routes to the editor default with the right aria-label', () => {
      render(<DualStatusBadge {...dualProps} />)
      const draft = screen.getByRole('link', {
        name: /Öppna utkast version 4 av Arbetsmiljöpolicy i editorn/,
      })
      expect(draft).toHaveAttribute(
        'href',
        '/workspace/styrdokument/doc-xyz-uuid-123/edit'
      )
    })

    it('both halves stop click propagation so the parent row navigation does not double-fire', async () => {
      const user = userEvent.setup()
      const onRowClick = vi.fn()
      render(
        // Simulating a table row's onClick handler — the unit-test scaffold
        // intentionally uses a non-interactive wrapper here to isolate the
        // event-propagation behaviour. Disabling the a11y rules locally.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div onClick={onRowClick}>
          <DualStatusBadge {...dualProps} />
        </div>
      )
      await user.click(
        screen.getByRole('link', { name: /Öppna godkänd version 3/ })
      )
      await user.click(
        screen.getByRole('link', { name: /Öppna utkast version 4/ })
      )
      expect(onRowClick).not.toHaveBeenCalled()
    })

    it('CP-001 — never renders raw documentId or versionId in the visible text', () => {
      render(<DualStatusBadge {...dualProps} />)
      const root = screen.getByRole('status').parentElement!
      const text = root.textContent ?? ''
      expect(text).not.toContain('doc-xyz-uuid-123')
      expect(text).not.toContain('v-approved')
      expect(text).not.toContain('v-draft')
    })
  })

  describe('single approved state', () => {
    const props = {
      ...baseProps,
      status: 'APPROVED',
      currentApprovedVersionId: 'v-approved',
      currentApprovedVersionNumber: 3,
    }

    it("renders today's APPROVED badge wrapped in a single anchor", () => {
      render(<DualStatusBadge {...props} />)
      expect(screen.getByText('Godkänd')).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /Öppna Arbetsmiljöpolicy/ })
      expect(link).toHaveAttribute(
        'href',
        '/workspace/styrdokument/doc-xyz-uuid-123/edit'
      )
    })

    it('does NOT expose role="status" (single state needs no aria-region)', () => {
      render(<DualStatusBadge {...props} />)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('single draft state', () => {
    it("renders today's DRAFT badge wrapped in a single anchor", () => {
      render(
        <DualStatusBadge
          {...baseProps}
          status="DRAFT"
          draftStatus="DRAFT"
          currentDraftVersionId="v-draft"
          currentDraftVersionNumber={1}
        />
      )
      expect(screen.getByText('Utkast')).toBeInTheDocument()
    })
  })

  describe('single in-review state', () => {
    it("renders today's IN_REVIEW badge wrapped in a single anchor", () => {
      render(
        <DualStatusBadge
          {...baseProps}
          status="IN_REVIEW"
          draftStatus="IN_REVIEW"
          currentDraftVersionId="v-draft"
          currentDraftVersionNumber={2}
        />
      )
      expect(screen.getByText('Under granskning')).toBeInTheDocument()
    })
  })

  describe('archived state', () => {
    it("renders today's ARCHIVED badge wrapped in a single anchor", () => {
      render(<DualStatusBadge {...baseProps} status="ARCHIVED" />)
      expect(screen.getByText('Arkiverad')).toBeInTheDocument()
    })
  })
})
