import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { BADGE_TONES, TONES, VARIANTS, type Tone } from '@/lib/ui/badge-tones'

/**
 * Build cva compound variants for every (tone, variant) cell from the token
 * map, so the cva config is the single consumer of `lib/ui/badge-tones.ts`.
 */
const toneCompoundVariants = TONES.flatMap((tone) =>
  VARIANTS.map((variant) => ({
    tone,
    variant,
    class: BADGE_TONES[tone][variant],
  }))
)

/**
 * Badge primitive.
 *
 * Two coexisting APIs:
 *
 * 1. **Tone-aware (preferred for status / priority / severity / type).**
 *    Pass `tone` ∈ neutral|info|success|warning|danger plus `variant`
 *    ∈ soft|solid|outline. Class strings come from `lib/ui/badge-tones.ts`
 *    via cva compound variants. Defaults: `tone="neutral"`, `variant="soft"`.
 *
 *    ```tsx
 *    <Badge tone="info" variant="soft">Pågående</Badge>
 *    <Badge tone="danger" variant="solid">Kritisk</Badge>
 *    ```
 *
 *    Domain components should call `getStatusBadgeProps(domain, value)` /
 *    `getPriorityBadgeProps(value)` from `@/lib/ui/badge-tones` and spread
 *    the result, never hand-roll the (tone, variant, label) tuple at the
 *    call site.
 *
 * 2. **Legacy shadcn variants (`default | secondary | destructive | outline`).**
 *    Retained for non-status uses (chrome decorations, callouts, etc).
 *    Deprecated for status / priority / severity — those MUST use the
 *    tone-aware API above. New code on a status surface that ships with a
 *    legacy variant value will fail PR review.
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      // Legacy shadcn axis. Status-domain values must NOT use these.
      variant: {
        default:
          'border border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        // Tone-aware variants — class strings supplied by compoundVariants
        // when paired with a `tone`. Bare usage (no tone) falls back to
        // a transparent border / no fill.
        outline: 'border text-foreground',
        soft: '',
        solid: '',
      },
      tone: {
        neutral: '',
        info: '',
        success: '',
        warning: '',
        danger: '',
      },
    },
    compoundVariants: toneCompoundVariants,
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  tone?: Tone | undefined
}

function Badge({ className, variant, tone, ...props }: BadgeProps) {
  // When `tone` is supplied without an explicit `variant`, default to
  // `soft` (the canonical status pill shape) instead of falling back to
  // the legacy shadcn `default` variant.
  const effectiveVariant = tone && variant === undefined ? 'soft' : variant
  return (
    <span
      className={cn(
        badgeVariants({ variant: effectiveVariant, tone }),
        className
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
