/**
 * Open-beta badge — a small neutral pill shown next to the wordmark.
 *
 * Temporary: this is a 4-week open-beta marker. To remove it after beta,
 * delete this file and its two usages in `navbar.tsx` (desktop + mobile
 * logo). No flag, no env var — a deliberate one-commit revert.
 */

import { cn } from '@/lib/utils'

export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-safiro inline-flex select-none items-center rounded-full border px-2 py-0.5',
        'text-[10px] uppercase tracking-wide',
        'border-border bg-muted text-muted-foreground',
        className
      )}
    >
      Beta
    </span>
  )
}
