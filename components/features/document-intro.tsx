'use client'

import type { ReactNode } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

interface DocumentIntroAccordionItem {
  /** Stable value used by Accordion state (e.g. 'summary', 'metadata', 'related') */
  value: string
  /** Left side of the trigger — usually an icon + label */
  label: ReactNode
  /** Right-aligned hint (e.g. "22 ändringar") — muted, small */
  hint?: ReactNode
  /** Panel content */
  children: ReactNode
}

interface DocumentIntroAccordionProps {
  items: DocumentIntroAccordionItem[]
  /** Values that should be expanded by default */
  defaultValue?: string[]
  className?: string
}

/**
 * Intro accordion — matches the legal-document-modal's accordion grammar so
 * the full-page view uses the same visual language as the in-list modal.
 *
 * Each item renders as `border rounded-lg border-border/60` with a hover-muted
 * trigger. Multiple items can be open at once.
 */
export function DocumentIntroAccordion({
  items,
  defaultValue,
  className,
}: DocumentIntroAccordionProps) {
  if (items.length === 0) return null

  return (
    <Accordion
      type="multiple"
      defaultValue={defaultValue ?? items.map((i) => i.value)}
      className={cn('space-y-2', className)}
    >
      {items.map((item) => (
        <AccordionItem
          key={item.value}
          value={item.value}
          className="overflow-hidden rounded-lg border border-border/60 bg-card"
        >
          <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/40 rounded-t-lg data-[state=closed]:rounded-lg [&[data-state=open]]:border-b [&[data-state=open]]:border-border/40">
            <span className="flex flex-1 items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                {item.label}
              </span>
              {item.hint && (
                <span className="text-xs font-normal text-muted-foreground mr-2">
                  {item.hint}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5 pt-4">
            {item.children}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
