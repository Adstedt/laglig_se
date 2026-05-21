'use client'

/**
 * Story 6.3 follow-up: Left-panel group header.
 * Clickable header that chunks the modal's accordions into collapsible groups
 * (Efterlevnad / Referens / Underlag). Designed to be used as the child of a
 * <CollapsibleTrigger asChild> — it renders a <button> and forwards the
 * trigger's onClick / aria / data-state, so the chevron and dimming react to
 * the group's open state automatically.
 *
 * Note: the previous `count` chip was removed (2026-05-21) — the counts were
 * static structural counts (Efterlevnad=3, Referens=1, Uppgifter&filer=2),
 * not dynamic data, so they trained the eye on noise. If we want to reuse
 * the slot, prefer a meaningful progress / status indicator over a count.
 */

import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export const AccordionGroupLabel = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<'button'>
>(({ children, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      'group/grouplabel flex w-full select-none items-center gap-3 px-1 pb-1 pt-3 text-left',
      className
    )}
    {...props}
  >
    <span className="font-safiro text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors group-hover/grouplabel:text-foreground group-data-[state=closed]/grouplabel:opacity-70">
      {children}
    </span>
    <span className="h-px flex-1 bg-border" aria-hidden="true" />
    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/grouplabel:rotate-180" />
  </button>
))
AccordionGroupLabel.displayName = 'AccordionGroupLabel'
