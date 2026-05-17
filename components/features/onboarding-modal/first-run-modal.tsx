'use client'

/**
 * Story 25.0 (Epic 25): First-run onboarding modal — shell.
 * Story 25.1: B.1 production upgrade.
 * Story 25.2: B.2 tutorial step with progress strip + tab framework.
 * Story 25.3: B.3 six tutorial content panels.
 * Story 25.4: B.4 done states for template/generate/import paths.
 * Post-25.1 visual-polish pass: aligned with the prototype frame ② chrome
 * (wordmark + progress + personalised welcome header + footer with security
 * reassurance + right-aligned skip link).
 *
 * Top-level Dialog wrapper mounted by `<HemPage>` when the dashboard's
 * server-derived `onboardingState.firstRunOpen` is true. Hosts a local
 * `step` state covering 7 values (path-choice / template-pick / import-upload /
 * tutorial + 3 done-* states added in B.4).
 *
 * Dismissal contract: no X button, no Esc dismissal, no outside-click
 * dismissal — closing is explicit via a path choice or the Hoppa över
 * guiden tertiary link.
 *
 * B.4 transition rules:
 *   - tutorial → done-generate (success | failed) when SWR sees the
 *     generation-status flip to 'completed' or 'failed'.
 *   - import-upload → done-import when <ImportUploadStep> onSuccess fires
 *     (replaces 25.1's immediate route to /granska).
 *   - template-pick → done-template when <TemplatePickStep> onTemplateApplied
 *     fires (replaces 25.1's route to /mallar/{slug}).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
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
import { getImport } from '@/app/actions/law-list-import'
import { PathChoiceStep } from './path-choice-step'
import { TemplatePickStep } from './template-pick-step'
import { ImportUploadStep } from './import-upload-step'
import { TutorialStep } from './tutorial-step'
import { DoneGenerateStep } from './done-generate-step'
import { DoneImportStep } from './done-import-step'
import { DoneTemplateStep } from './done-template-step'
import { runDismissAction } from './run-dismiss-action'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

type Step =
  | 'path-choice'
  | 'template-pick'
  | 'import-upload'
  | 'tutorial'
  | 'done-generate'
  | 'done-import'
  | 'done-template'

/**
 * Story 25.2: locally-defined 4-string union so the modal does not depend on
 * `<LawListGenerationProgress>` internals. Matches the API contract directly.
 */
type GenerationStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

/**
 * Story 25.4: subset of /api/workspace/generation-status response — the
 * fields B.4's done-generate transition + display logic needs. `startedAt`
 * was added to the API in Story 25.3 v0.5 (see
 * `app/api/workspace/generation-status/route.ts:134-135`).
 */
interface GenerationStatusResponse {
  status: GenerationStatus
  itemCount?: number
  groups?: Array<{ name: string; count: number }>
  error: string | null
  startedAt?: string | null
}

const fetcher = (url: string) =>
  fetch(url).then((res) => res.json() as Promise<GenerationStatusResponse>)

interface FirstRunModalProps {
  open: boolean
  templates?: PublishedTemplate[] | undefined
  /** User's first name for the personalised "Välkommen, {name}" headline. */
  userFirstName?: string | undefined
  /**
   * Story 25.2: server-derived initial generation status, passed through to
   * the tutorial step's <ProgressStrip> so the first paint is non-empty.
   */
  initialStatus?: GenerationStatus | null | undefined
}

function headerForStep(
  step: Step,
  userFirstName: string | undefined,
  mode: 'success' | 'failed' = 'success'
) {
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
    case 'tutorial':
      return {
        title: 'Vi skapar er personliga laglista',
        description:
          'Du kan stänga rutan — vi fortsätter i bakgrunden och notifierar när det är klart.',
        progress: 'KOM IGÅNG · STEG 2 AV 2',
      }
    case 'done-generate':
      return mode === 'failed'
        ? {
            title: 'Genereringen misslyckades',
            description: 'Försök igen eller välj ett annat alternativ.',
            progress: 'KLAR · 2 AV 2',
          }
        : {
            title: 'Er laglista är klar',
            description: 'Genererad utifrån er företagsprofil.',
            progress: 'KLAR · 2 AV 2',
          }
    case 'done-import':
      return mode === 'failed'
        ? {
            title: 'Matchningen misslyckades',
            description:
              'Vårt team kollar — skapa ett supportärende så återkommer vi.',
            progress: 'KLAR · 2 AV 2',
          }
        : {
            title: 'Matchningen är klar',
            description: 'Granska och hantera resultatet på en egen sida.',
            progress: 'KLAR · 2 AV 2',
          }
    case 'done-template':
      return {
        title: 'Mallen är aktiverad',
        description: 'Er laglista är skapad från en bransch-mall.',
        progress: 'KLAR · 2 AV 2',
      }
  }
}

interface ImportCounts {
  highCount: number
  mediumCount: number
  unmatchedCount: number
}

interface TemplateApplyResult {
  listId: string
  listName: string
  itemCount: number
}

export function FirstRunModal({
  open: initialOpen,
  templates,
  userFirstName,
  initialStatus,
}: FirstRunModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(initialOpen)
  const [step, setStep] = useState<Step>('path-choice')

  // B.4 state — payloads for the three done steps.
  const [importIdState, setImportIdState] = useState<string | null>(null)
  const [importCounts, setImportCounts] = useState<ImportCounts | null>(null)
  const [templateApplyResult, setTemplateApplyResult] =
    useState<TemplateApplyResult | null>(null)
  // B.4 generate-failure variant — error message from the API (success-mode
  // generate uses SWR data; failure mode just needs the error string).
  const [generateErrorMessage, setGenerateErrorMessage] = useState<
    string | null
  >(null)
  // done-import failed mode — exposed via a tiny escape hatch (not auto-
  // triggered in B.4 per AC 20; reserved for a future hardening pass).
  const [importFailureMode, setImportFailureMode] = useState(false)

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

  // B.4 telemetry: each done step fires `done_shown` exactly once on entry,
  // even under React StrictMode double-render. Map<Step, true> keyed by step.
  const doneShownFiredRef = useRef<Map<Step, true>>(new Map())

  // B.4: shared SWR fetch for generation-status. Re-uses the same key as
  // <ProgressStrip> so the cache is warm (no double fetch).
  const { data: generationData } = useSWR<GenerationStatusResponse>(
    '/api/workspace/generation-status',
    fetcher,
    {
      refreshInterval: (latest) => {
        const s = latest?.status ?? initialStatus
        return s === 'pending' || s === 'in_progress' ? 3000 : 0
      },
      revalidateOnFocus: false,
    }
  )
  const generationStatus = generationData?.status ?? initialStatus ?? null

  // B.4 auto-transition: tutorial → done-generate when generation completes
  // or fails. Captures the error message for failed-mode display.
  useEffect(() => {
    if (step !== 'tutorial') return
    if (generationStatus === 'completed') {
      setGenerateErrorMessage(null)
      setStep('done-generate')
      return
    }
    if (generationStatus === 'failed') {
      setGenerateErrorMessage(generationData?.error ?? null)
      setStep('done-generate')
    }
  }, [step, generationStatus, generationData?.error])

  // B.4 telemetry: fire done_shown once per done-* step entry (StrictMode-safe).
  useEffect(() => {
    if (
      step !== 'done-generate' &&
      step !== 'done-import' &&
      step !== 'done-template'
    ) {
      return
    }
    if (doneShownFiredRef.current.has(step)) return
    doneShownFiredRef.current.set(step, true)
    const path =
      step === 'done-generate'
        ? 'generate'
        : step === 'done-import'
          ? 'import'
          : 'template'
    const mode: 'success' | 'failed' =
      step === 'done-generate' && generationStatus === 'failed'
        ? 'failed'
        : step === 'done-import' && importFailureMode
          ? 'failed'
          : 'success'
    void recordOnboardingEvent('done_shown', { path, mode })
  }, [step, generationStatus, importFailureMode])

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

  /**
   * Story 25.2 (B.2): Minimera handler called from the tutorial step body.
   * Same shape as handleSkip per Story 25.1 polish — on success, close +
   * router.refresh() + router.push('/dashboard') so the dashboard server
   * component re-renders and mounts <LawListGenerationProgress>.
   *
   * Note: minimiseFirstRunModal still hardcodes `from_state: 'path_choice'`
   * in its OnboardingEvent write (see app/actions/onboarding-modal.ts:72-74).
   * B.2 leaves this as-is — funnel reports will conflate path-choice and
   * tutorial dismisses until B.6 reworks the server action signature.
   */
  async function handleMinimiseFromTutorial() {
    if (
      !(await runDismissAction(minimiseFirstRunModal, 'minimiseFirstRunModal'))
    ) {
      return
    }
    handleClose()
    router.refresh()
    router.push('/dashboard')
  }

  /**
   * Story 25.4 (B.4) pivot: replace 25.1's immediate-route behaviour with a
   * done-import transition. Counts come from getImport(importId).counts
   * (Story 24.4). We log the path_chosen event eagerly so funnel reports
   * still capture the choice even if the user abandons before the done step.
   * If getImport fails, fall back to a route-out (preserves 25.1 behaviour
   * for the unhappy path).
   */
  async function handleImportSuccess(importId: string) {
    void recordOnboardingEvent('path_chosen', {
      path: 'import',
      import_id: importId,
    })
    const result = await getImport(importId)
    if (!result.success || !result.data) {
      // Fall back to 25.1 behaviour if we can't load counts.
      if (
        !(await runDismissAction(
          minimiseFirstRunModal,
          'minimiseFirstRunModal'
        ))
      ) {
        return
      }
      handleClose()
      router.push(`/laglistor/skapa/${importId}/granska`)
      return
    }
    setImportIdState(importId)
    setImportCounts({
      highCount: result.data.counts.matched_high,
      mediumCount: result.data.counts.matched_medium,
      unmatchedCount: result.data.counts.unmatched,
    })
    setImportFailureMode(false)
    setStep('done-import')
  }

  // B.4 handlers for the new done-step CTAs.
  const handleShowList = useCallback(async () => {
    void recordOnboardingEvent('done_cta_clicked', {
      path: 'generate',
      cta: 'show_list',
    })
    if (
      !(await runDismissAction(minimiseFirstRunModal, 'minimiseFirstRunModal'))
    ) {
      return
    }
    handleClose()
    router.push('/laglistor')
  }, [router])

  const handleGoToReview = useCallback(async () => {
    if (!importIdState) return
    void recordOnboardingEvent('done_cta_clicked', {
      path: 'import',
      cta: 'go_to_review',
    })
    if (
      !(await runDismissAction(minimiseFirstRunModal, 'minimiseFirstRunModal'))
    ) {
      return
    }
    handleClose()
    router.push(`/laglistor/skapa/${importIdState}/granska`)
  }, [importIdState, router])

  const handleShowTemplateList = useCallback(async () => {
    if (!templateApplyResult) return
    void recordOnboardingEvent('done_cta_clicked', {
      path: 'template',
      cta: 'show_list',
    })
    if (
      !(await runDismissAction(minimiseFirstRunModal, 'minimiseFirstRunModal'))
    ) {
      return
    }
    handleClose()
    // /laglistor is a single index page; use the ?list= deep-link convention
    // from Story 4.13 Task 0 to land on the newly-adopted list directly.
    // There is NO `/laglistor/[listId]` route — that would 404.
    router.push(`/laglistor?list=${templateApplyResult.listId}`)
  }, [templateApplyResult, router])

  // B.4 owner decision v0.4: the "Fortsätt utforska" CTA is rendered DISABLED
  // in each done step (handler plumbed but never invoked). B.6 will swap one
  // line per step to enable + invoke. Kept as a no-op so a future copy-edit
  // doesn't accidentally remove the prop.
  const handleKeepExploring = useCallback(() => {
    /* intentionally no-op until B.6 enables the button. */
  }, [])

  const handleRetryGenerate = useCallback(async () => {
    void recordOnboardingEvent('done_cta_clicked', {
      path: 'generate',
      cta: 'retry',
    })
    try {
      await fetch('/api/workspace/generate-law-list', { method: 'POST' })
    } catch {
      // Swallow — the SWR poll will surface any persistent failure.
    }
    setGenerateErrorMessage(null)
    setStep('tutorial')
  }, [])

  const handleCreateSupportTicket = useCallback(() => {
    if (!importIdState) return
    void recordOnboardingEvent('done_cta_clicked', {
      path: 'import',
      cta: 'retry',
    })
    const subject = encodeURIComponent(`[Import-fel] ${importIdState}`)
    const body = encodeURIComponent(
      `Hej!\n\nVi behöver hjälp med importen ${importIdState}. Vi kunde inte matcha våra rader mot katalogen.\n\nTack!`
    )
    window.location.href = `mailto:dev@laglig.se?subject=${subject}&body=${body}`
  }, [importIdState])

  const handleCloseFailure = useCallback(async () => {
    void recordOnboardingEvent('done_cta_clicked', {
      path: step === 'done-import' ? 'import' : 'generate',
      cta: 'close_failure',
    })
    if (
      !(await runDismissAction(minimiseFirstRunModal, 'minimiseFirstRunModal'))
    ) {
      return
    }
    handleClose()
  }, [step])

  const handleTemplateApplied = useCallback((result: TemplateApplyResult) => {
    setTemplateApplyResult(result)
    setStep('done-template')
  }, [])

  // Derive mode for done-* steps so headerForStep can swap the DialogTitle +
  // DialogDescription to the failure framing when the body is rendering the
  // failure variant. Other steps don't have a failure mode.
  const headerMode: 'success' | 'failed' =
    step === 'done-generate' && generationStatus === 'failed'
      ? 'failed'
      : step === 'done-import' && importFailureMode
        ? 'failed'
        : 'success'

  const { title, description, progress } = useMemo(
    () => headerForStep(step, userFirstName, headerMode),
    [step, userFirstName, headerMode]
  )

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
            'fixed left-[50%] top-[50%] z-50 flex w-full flex-col',
            // Story 25.3 post-Done polish: tutorial step needs more horizontal
            // room for the 2-col panel grid AND a STABLE height so chrome
            // doesn't jiggle when switching between tabs of different content
            // lengths. h-[760px] gives consistent vertical real estate.
            // Story 25.4 (B.4): done-generate continues at 1200px (no
            // jarring resize from tutorial → done) but drops the fixed
            // height since it's size-to-content. done-import + done-template
            // stay at 760px (continue from import-upload + template-pick).
            step === 'tutorial'
              ? 'h-[760px] max-h-[90vh] max-w-[1200px]'
              : step === 'done-generate'
                ? 'max-h-[90vh] max-w-[1200px]'
                : 'max-h-[90vh] max-w-[760px]',
            // OUTER modal does NOT scroll — only the tab body inside
            // <TutorialStep> does (via flex-1 + overflow-y-auto + scroll-shadows
            // affordance in tutorial-step.tsx). Keeps chrome, header, progress
            // strip, tab bar, and Minimera button visually pinned while the
            // panel content scrolls underneath them.
            'overflow-hidden',
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

          {/* Step body — for tutorial step, this is a flex column that fills
              the remaining modal height so <TutorialStep>'s inner tab body can
              be the scroll boundary (instead of the whole modal). Other steps
              stay as a plain block. */}
          <div
            ref={stepRef}
            className={cn(
              'px-8 pt-6',
              step === 'tutorial' && 'flex min-h-0 flex-1 flex-col'
            )}
          >
            {step === 'path-choice' && (
              <PathChoiceStep
                onClose={handleClose}
                onPickTemplate={() => setStep('template-pick')}
                onPickImport={() => setStep('import-upload')}
                onPickGenerate={() => setStep('tutorial')}
              />
            )}

            {step === 'template-pick' && (
              <TemplatePickStep
                templates={templates ?? []}
                onBack={() => setStep('path-choice')}
                onClose={handleClose}
                onTemplateApplied={handleTemplateApplied}
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

            {step === 'tutorial' && (
              <TutorialStep
                initialStatus={initialStatus}
                onMinimise={handleMinimiseFromTutorial}
              />
            )}

            {step === 'done-generate' && (
              <DoneGenerateStep
                mode={generationStatus === 'failed' ? 'failed' : 'success'}
                itemCount={generationData?.itemCount ?? null}
                groups={generationData?.groups ?? null}
                startedAt={generationData?.startedAt ?? null}
                errorMessage={generateErrorMessage}
                onShowList={handleShowList}
                onKeepExploring={handleKeepExploring}
                onRetry={handleRetryGenerate}
                onCloseFailure={handleCloseFailure}
              />
            )}

            {step === 'done-import' && importIdState && importCounts && (
              <DoneImportStep
                mode={importFailureMode ? 'failed' : 'success'}
                counts={importCounts}
                importId={importIdState}
                onGoToReview={handleGoToReview}
                onKeepExploring={handleKeepExploring}
                onCreateSupportTicket={handleCreateSupportTicket}
                onCloseFailure={handleCloseFailure}
              />
            )}

            {step === 'done-template' && templateApplyResult && (
              <DoneTemplateStep
                listId={templateApplyResult.listId}
                listName={templateApplyResult.listName}
                itemCount={templateApplyResult.itemCount}
                onShowList={handleShowTemplateList}
                onKeepExploring={handleKeepExploring}
              />
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
