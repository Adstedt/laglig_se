'use client'

/**
 * Story 25.1 (Epic 25): First-run modal — inline template-pick sub-step.
 *
 * Reuses `<TemplateOptionCard>` (Story 12.10b) and the server-prefetched
 * `PublishedTemplate[]` from the dashboard so the picker opens with zero
 * latency. Selecting a template records the event with `template_slug`,
 * dismisses the modal, and routes to `/laglistor/mallar/{slug}` where the
 * existing apply-template flow lives. Tillbaka reverts to path-choice
 * without firing any server action (AC 19).
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TemplateOptionCard } from '@/components/features/document-list/template-option-card'
import {
  minimiseFirstRunModal,
  recordOnboardingEvent,
} from '@/app/actions/onboarding-modal'
import { runDismissAction } from './run-dismiss-action'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

interface TemplatePickStepProps {
  templates: PublishedTemplate[]
  onBack: () => void
  onClose: () => void
}

export function TemplatePickStep({
  templates,
  onBack,
  onClose,
}: TemplatePickStepProps) {
  const router = useRouter()
  // AC 32: focus the first TemplateOptionCard on mount; if there are none,
  // focus the Tillbaka button as the only interactive affordance.
  const listRef = useRef<HTMLDivElement | null>(null)
  const backRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
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
  }, [templates.length])

  async function handleSelect(template: PublishedTemplate) {
    void recordOnboardingEvent('path_chosen', {
      path: 'template',
      template_slug: template.slug,
    })
    // QA ROBUST-001 fix: await the minimise so a silent failure doesn't leave
    // the modal poised to re-open on the next dashboard visit.
    if (
      !(await runDismissAction(minimiseFirstRunModal, 'minimiseFirstRunModal'))
    ) {
      return
    }
    onClose()
    router.push(`/laglistor/mallar/${template.slug}`)
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
