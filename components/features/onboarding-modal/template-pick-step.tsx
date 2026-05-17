'use client'

/**
 * Story 25.1 (Epic 25): First-run modal — inline template-pick sub-step.
 * Story 25.4 (B.4) pivot: replaced the route-out behaviour with an inline
 * `adoptTemplate` call. On success, the result `{listId, listName, itemCount}`
 * is bubbled up via `onTemplateApplied` and the parent transitions to the
 * done-template step. On failure, `toast.error` fires and the user stays on
 * template-pick (they can pick a different template or click Tillbaka).
 *
 * Reuses `<TemplateOptionCard>` (Story 12.10b) and the server-prefetched
 * `PublishedTemplate[]` from the dashboard so the picker opens with zero
 * latency. Tillbaka reverts to path-choice without firing any server action.
 */

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TemplateOptionCard } from '@/components/features/document-list/template-option-card'
import { recordOnboardingEvent } from '@/app/actions/onboarding-modal'
import { adoptTemplate } from '@/app/actions/template-adoption'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

interface TemplatePickStepProps {
  templates: PublishedTemplate[]
  onBack: () => void
  onClose: () => void
  /**
   * Story 25.4 (B.4) — invoked after a successful `adoptTemplate` call so
   * the parent can transition to `step='done-template'` with the apply
   * result. Replaces the 25.1 route-out behaviour.
   */
  onTemplateApplied: (_result: {
    listId: string
    listName: string
    itemCount: number
  }) => void
}

export function TemplatePickStep({
  templates,
  onBack,
  onClose: _onClose,
  onTemplateApplied,
}: TemplatePickStepProps) {
  const [isApplying, setIsApplying] = useState(false)

  // AC 32: focus the first TemplateOptionCard on mount; if there are none,
  // focus the Tillbaka button as the only interactive affordance.
  const listRef = useRef<HTMLDivElement | null>(null)
  const backRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (isApplying) return
    const id = requestAnimationFrame(() => {
      if (templates.length === 0) {
        backRef.current?.focus()
        return
      }
      const firstCard =
        listRef.current?.querySelector<HTMLElement>('[role="button"]')
      firstCard?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [templates.length, isApplying])

  async function handleSelect(template: PublishedTemplate) {
    setIsApplying(true)

    const result = await adoptTemplate({ templateSlug: template.slug })

    if (result.success && result.data) {
      void recordOnboardingEvent('path_chosen', {
        path: 'template',
        template_slug: template.slug,
        list_id: result.data.listId,
      })
      onTemplateApplied(result.data)
      return
    }

    toast.error(result.error ?? 'Mallen kunde inte aktiveras')
    setIsApplying(false)
  }

  if (isApplying) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2
          className="h-5 w-5 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">Skapar er laglista...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button ref={backRef} variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Tillbaka
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Inga publicerade mallar tillgängliga. Återgå till valet ovan för att
            välja en annan väg.
          </p>
        </div>
      ) : (
        <div ref={listRef} className="flex flex-col gap-2">
          {templates.map((template) => (
            <TemplateOptionCard
              key={template.id}
              template={template}
              onClick={() => handleSelect(template)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
