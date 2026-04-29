import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from '@/components/ui/badge'
import {
  BADGE_TONES,
  TONES,
  VARIANTS,
  type Tone,
  type Variant,
} from '@/lib/ui/badge-tones'

/**
 * Story 22.1 — Badge primitive contract.
 *
 * Two coexisting APIs:
 *  1. Tone-aware: <Badge tone variant>...</Badge> (status / priority / severity)
 *  2. Legacy shadcn variants: <Badge variant="default|secondary|...">...</Badge>
 *     (kept compiling for non-status callers)
 */

describe('Badge — tone × variant matrix (15 cells)', () => {
  for (const tone of TONES) {
    for (const variant of VARIANTS) {
      it(`renders tone="${tone}" variant="${variant}" with the BADGE_TONES class string`, () => {
        const { container } = render(
          <Badge tone={tone} variant={variant}>
            label
          </Badge>
        )
        const span = container.firstElementChild as HTMLElement
        // Class strings can include multiple tokens; assert each is present.
        const expected = BADGE_TONES[tone][variant].split(/\s+/)
        for (const cls of expected) {
          expect(span).toHaveClass(cls)
        }
      })
    }
  }
})

describe('Badge — defaults', () => {
  it('renders the legacy shadcn `default` variant when neither tone nor variant is provided', () => {
    const { container } = render(<Badge>label</Badge>)
    const span = container.firstElementChild as HTMLElement
    expect(span).toHaveClass('bg-primary')
    expect(span).toHaveClass('text-primary-foreground')
  })

  it('defaults to soft variant when tone is provided without an explicit variant', () => {
    const { container } = render(<Badge tone="info">label</Badge>)
    const span = container.firstElementChild as HTMLElement
    const expected = BADGE_TONES.info.soft.split(/\s+/)
    for (const cls of expected) {
      expect(span).toHaveClass(cls)
    }
  })
})

describe('Badge — legacy variant API (regression guard)', () => {
  const legacyVariants = [
    'default',
    'secondary',
    'destructive',
    'outline',
  ] as const
  for (const variant of legacyVariants) {
    it(`continues to compile and render variant="${variant}" without a tone`, () => {
      const { container } = render(<Badge variant={variant}>legacy</Badge>)
      expect(container.firstElementChild).toBeInTheDocument()
    })
  }
})

describe('Badge — class merge', () => {
  it('caller-supplied className is merged after variant classes', () => {
    const { container } = render(
      <Badge tone="success" className="custom-class">
        ok
      </Badge>
    )
    const span = container.firstElementChild as HTMLElement
    expect(span).toHaveClass('custom-class')
  })
})

describe('Badge — content', () => {
  it('renders children verbatim', () => {
    const { getByText } = render(
      <Badge tone="warning">
        <span>Inline child</span>
      </Badge>
    )
    expect(getByText('Inline child')).toBeInTheDocument()
  })
})

// Type-level guard — exists to fail at compile-time if Tone / Variant unions
// drift from the BADGE_TONES map shape.
describe('badge-tones — type alignment', () => {
  it('every Tone has every Variant in BADGE_TONES', () => {
    for (const tone of TONES) {
      for (const variant of VARIANTS) {
        const cell = BADGE_TONES[tone as Tone][variant as Variant]
        expect(cell).toBeTruthy()
        expect(typeof cell).toBe('string')
      }
    }
  })
})
