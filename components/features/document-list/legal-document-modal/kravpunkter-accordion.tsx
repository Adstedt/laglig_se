'use client'

/**
 * Story 21.22: Kravpunkter accordion — extracted from the old `compliance-actions.tsx`
 * which used to bundle the structured checklist with a "Generella kommentarer"
 * free-text field. The free text is now a first-class top-level accordion
 * ("Hur efterlever vi kraven?" — see `compliance-narrative.tsx`), so this
 * accordion focuses solely on the structured kravpunkter checklist.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  KravpunkterChecklist,
  type KravpunkterProgress,
} from './kravpunkter-checklist'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'

interface KravpunkterAccordionProps {
  listItemId: string
  /**
   * 'kravpunkter' → scroll header into view (section already open by default).
   * Other values → no-op.
   */
  focusField?:
    | 'businessContext'
    | 'complianceNarrative'
    | 'kravpunkter'
    | null
    | undefined
  readOnly?: boolean | undefined
  onProgressChange?: ((_progress: KravpunkterProgress) => void) | undefined
  workspaceMembers?: WorkspaceMemberOption[] | undefined
  listItemResponsibleUserId?: string | null | undefined
  focusRequirementId?: string | undefined
}

export function KravpunkterAccordion({
  listItemId,
  focusField,
  readOnly = false,
  onProgressChange,
  workspaceMembers,
  listItemResponsibleUserId,
  focusRequirementId,
}: KravpunkterAccordionProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [progress, setProgress] = useState<KravpunkterProgress>({
    fulfilled: 0,
    total: 0,
  })
  const [highlighted, setHighlighted] = useState(false)

  useEffect(() => {
    const handler = () => {
      setHighlighted(true)
      const t = window.setTimeout(() => setHighlighted(false), 1500)
      return () => window.clearTimeout(t)
    }
    window.addEventListener('laglig:focus-kravpunkter', handler)
    return () => window.removeEventListener('laglig:focus-kravpunkter', handler)
  }, [])

  useEffect(() => {
    if (focusField !== 'kravpunkter') return
    const timer = setTimeout(() => {
      triggerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 150)
    return () => clearTimeout(timer)
  }, [focusField])

  // Stable identity so the child checklist's useEffect dep array doesn't re-fire
  // every render and trigger an infinite loop (the effect calls onProgressChange,
  // which calls setProgress, which re-renders, which would otherwise produce a
  // fresh handler reference and re-fire the effect). Bail out of setProgress when
  // values are identical so React skips the re-render entirely on no-op updates.
  const handleProgressChange = useCallback(
    (next: KravpunkterProgress) => {
      setProgress((prev) =>
        prev.fulfilled === next.fulfilled && prev.total === next.total
          ? prev
          : next
      )
      onProgressChange?.(next)
    },
    [onProgressChange]
  )

  return (
    <AccordionItem
      value="kravpunkter"
      id="kravpunkter-accordion"
      className={cn(
        'border rounded-lg border-border/60 scroll-mt-4 transition-shadow duration-500',
        highlighted && 'ring-2 ring-amber-400/70 shadow-lg'
      )}
    >
      <AccordionTrigger
        ref={triggerRef}
        className="px-4 py-3 hover:no-underline hover:bg-muted/50 rounded-t-lg data-[state=closed]:rounded-lg"
      >
        <div className="flex items-center gap-2 text-base font-semibold text-foreground flex-1">
          <ClipboardCheck className="h-4 w-4" />
          <span>Kravpunkter</span>
          {progress.total > 0 && (
            <div className="flex items-center gap-2 ml-auto mr-2 font-normal">
              <span className="text-xs text-muted-foreground tabular-nums">
                {progress.fulfilled}/{progress.total} uppfyllda
              </span>
              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      progress.total > 0
                        ? Math.round(
                            (progress.fulfilled / progress.total) * 100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <KravpunkterChecklist
          listItemId={listItemId}
          readOnly={readOnly}
          onProgressChange={handleProgressChange}
          workspaceMembers={workspaceMembers}
          listItemResponsibleUserId={listItemResponsibleUserId ?? null}
          focusRequirementId={focusRequirementId}
        />
      </AccordionContent>
    </AccordionItem>
  )
}
