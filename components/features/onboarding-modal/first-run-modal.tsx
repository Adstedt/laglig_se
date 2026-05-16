'use client'

/**
 * Story 25.0 (Epic 25): First-run onboarding modal — shell.
 * Story 25.1: B.1 production upgrade.
 * Post-25.1 visual-polish pass: aligned with the prototype frame ② chrome
 * (wordmark + progress + personalised welcome header + footer with security
 * reassurance + right-aligned skip link).
 *
 * Top-level Dialog wrapper mounted by `<HemPage>` when the dashboard's
 * server-derived `onboardingState.firstRunOpen` is true. Hosts a local
 * `step: 'path-choice' | 'template-pick' | 'import-upload'` state so the
 * three sub-steps swap inside the same Dialog (preserves focus, animation,
 * and the open-event guard).
 *
 * Dismissal contract: no X button, no Esc dismissal, no outside-click
 * dismissal — closing is explicit via a path choice or the Hoppa över
 * guiden tertiary link.
 */

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Lock } from 'lucide-react'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  minimiseFirstRunModal,
  recordOnboardingEvent,
  skipLawListGeneration,
} from '@/app/actions/onboarding-modal'
import { PathChoiceStep } from './path-choice-step'
import { TemplatePickStep } from './template-pick-step'
import { ImportUploadStep } from './import-upload-step'
import { runDismissAction } from './run-dismiss-action'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

type Step = 'path-choice' | 'template-pick' | 'import-upload'

interface FirstRunModalProps {
  open: boolean
  templates?: PublishedTemplate[] | undefined
  /** User's first name for the personalised "Välkommen, {name}" headline. */
  userFirstName?: string | undefined
}

function headerForStep(step: Step, userFirstName: string | undefined) {
  switch (step) {
    case 'path-choice':
      return {
        title: userFirstName ? `Välkommen, ${userFirstName}` : 'Välkommen',
        description:
          'Vi sätter upp din första laglista — välj hur. Båda vägarna tar några minuter, och du kan följa arbetet i realtid.',
        progress: 'KOM IGÅNG · STEG 1 AV 2',
      }
    case 'template-pick':
      return {
        title: 'Välj en mall',
        description: 'Välj en bransch-mall — listan skapas direkt.',
        progress: 'KOM IGÅNG · STEG 2 AV 2',
      }
    case 'import-upload':
      return {
        title: 'Importera befintlig laglista',
        description: 'Ladda upp en .xlsx / .csv eller klistra in raderna.',
        progress: 'KOM IGÅNG · STEG 2 AV 2',
      }
  }
}

export function FirstRunModal({
  open: initialOpen,
  templates,
  userFirstName,
}: FirstRunModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(initialOpen)
  const [step, setStep] = useState<Step>('path-choice')

  const stepRef = useRef<HTMLDivElement | null>(null)
  const isFirstStepRender = useRef(true)
  useEffect(() => {
    if (isFirstStepRender.current) {
      isFirstStepRender.current = false
      return
    }
    const id = requestAnimationFrame(() => {
      const root = stepRef.current
      if (!root) return
      const target = root.querySelector<HTMLElement>(
        '[data-onboarding-focus-target="true"]'
      )
      target?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [step])

  // QA ROBUST-002: ref guard so modal_opened fires exactly once.
  const openEventFired = useRef(false)
  useEffect(() => {
    if (openEventFired.current) return
    openEventFired.current = true
    void recordOnboardingEvent('modal_opened', { trigger: 'first_run' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleClose() {
    setOpen(false)
  }

  async function handleSkip() {
    if (
      !(await runDismissAction(skipLawListGeneration, 'skipLawListGeneration'))
    ) {
      return
    }
    handleClose()
  }

  async function handleImportSuccess(importId: string) {
    void recordOnboardingEvent('path_chosen', {
      path: 'import',
      import_id: importId,
    })
    if (
      !(await runDismissAction(minimiseFirstRunModal, 'minimiseFirstRunModal'))
    ) {
      return
    }
    handleClose()
    router.push(`/laglistor/skapa/${importId}/granska`)
  }

  const { title, description, progress } = headerForStep(step, userFirstName)

  return (
    <Dialog open={open}>
      <DialogPortal>
        <DialogOverlay className="bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          // Prevent Radix's autoFocus landing on Mall card (would trigger the
          // dark focus ring and fight the calm modal aesthetic).
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'fixed left-[50%] top-[50%] z-50 grid w-full max-w-[760px]',
            'translate-x-[-50%] translate-y-[-50%] border bg-background',
            'shadow-lg sm:rounded-2xl duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'
          )}
        >
          {/* Top chrome row: full Laglig logo (icon + wordmark baked in)
              on the left, progress on the right. Same logo asset and
              `invert dark:invert-0` pattern as the landing-page navbar. */}
          <div className="flex items-center justify-between px-8 pt-7">
            <Image
              src="/images/logo-final.png"
              alt="Laglig.se"
              width={176}
              height={67}
              className="h-8 w-auto invert dark:invert-0"
              priority
            />
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {progress}
            </span>
          </div>

          {/* Header copy */}
          <DialogHeader className="space-y-2 px-8 pt-6">
            <DialogTitle className="text-3xl font-medium tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>

          {/* Step body */}
          <div ref={stepRef} className="px-8 pt-6">
            {step === 'path-choice' && (
              <PathChoiceStep
                onClose={handleClose}
                onPickTemplate={() => setStep('template-pick')}
                onPickImport={() => setStep('import-upload')}
              />
            )}

            {step === 'template-pick' && (
              <TemplatePickStep
                templates={templates ?? []}
                onBack={() => setStep('path-choice')}
                onClose={handleClose}
              />
            )}

            {step === 'import-upload' && (
              <div className="flex flex-col gap-4">
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep('path-choice')}
                    data-onboarding-focus-target="true"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" /> Tillbaka
                  </Button>
                </div>
                <ImportUploadStep onSuccess={handleImportSuccess} hideHeader />
              </div>
            )}
          </div>

          {/* Footer (path-choice only) — separator + reassurance + skip */}
          {step === 'path-choice' && (
            <div className="mt-6 px-8 pb-7">
              <Separator className="mb-5" />
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  <span>Allt sparas i ert workspace, ingen delning utåt.</span>
                </div>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Hoppa över guiden
                </button>
              </div>
            </div>
          )}
          {/* Sub-steps get bottom padding to match */}
          {step !== 'path-choice' && <div className="pb-7" />}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
