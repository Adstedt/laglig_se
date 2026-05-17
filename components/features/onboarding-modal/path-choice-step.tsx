'use client'

/**
 * Story 25.0 (Epic 25): First-run modal — path-choice step.
 * Story 25.1 (B.1): four-card 2×2 grid (Mall / Generera / Tom lista / Importera).
 * Post-25.1 visual-polish pass: aligned with prototype frame ②
 *  - Mall card uses the dark/inverted "recommended" treatment
 *  - all cards get multi-line conversational body + CTA on its own line
 *  - tertiary skip link moved out to the modal-shell footer (so this step
 *    no longer renders it)
 *
 * Mall and Importera hand off to inline sub-steps via callback props;
 * Generera and Tom lista are direct-action cards (fire their own server
 * actions + close the modal).
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutTemplate,
  WandSparkles,
  FileUp,
  Plus,
  ArrowRight,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  minimiseFirstRunModal,
  recordOnboardingEvent,
} from '@/app/actions/onboarding-modal'
import { runDismissAction } from './run-dismiss-action'
import { cn } from '@/lib/utils'

interface PathChoiceStepProps {
  onClose: () => void
  onPickTemplate: () => void
  onPickImport: () => void
  /**
   * Story 25.2 (B.2): Generera success now transitions the modal to the
   * tutorial step instead of closing it. The parent shell owns the
   * step state; this prop signals "Generera succeeded, please advance."
   */
  onPickGenerate: () => void
}

export function PathChoiceStep({
  onClose,
  onPickTemplate,
  onPickImport,
  onPickGenerate,
}: PathChoiceStepProps) {
  const router = useRouter()
  // Track in-flight click on Generera so the card visibly disables + shows
  // a loading state — generateLawList can take minutes server-side and a
  // silent button invites repeated double-clicks (→ 409 conflicts).
  //
  // We use BOTH a ref (synchronous, blocks double-fire within a single
  // render cycle) and state (drives the UI). The ref is the source of truth
  // for the guard; the state mirrors it for rendering.
  const isGeneratingRef = useRef(false)
  const [isGenerating, setIsGenerating] = useState(false)

  function handleCardKeyDown(e: React.KeyboardEvent, action: () => void) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }

  function handleTemplate() {
    void recordOnboardingEvent('path_chosen', { path: 'template' })
    onPickTemplate()
  }

  async function handleGenerate() {
    // Synchronous ref-based guard — `isGenerating` state alone is too slow
    // because React state updates are async; a sub-frame double-click could
    // bypass the check and fire two concurrent fetches (one of which would
    // then 409 because the first already set status='in_progress').
    if (isGeneratingRef.current) return
    isGeneratingRef.current = true
    setIsGenerating(true)
    let alreadyInProgress = false
    try {
      const res = await fetch('/api/workspace/generate-law-list', {
        method: 'POST',
      })
      if (res.status === 409) {
        // Generation is already running (likely a previous click + the user
        // re-clicked, or a previous session left it in_progress). Treat as
        // success — the dashboard's <LawListGenerationProgress> banner will
        // show the real state.
        alreadyInProgress = true
      } else if (!res.ok) {
        throw new Error(`generate-law-list responded ${res.status}`)
      }
    } catch (err) {
      console.error('[FirstRunModal] generate-law-list failed', err)
      toast.error('Något gick fel. Försök igen.')
      isGeneratingRef.current = false
      setIsGenerating(false)
      return
    }

    // Only record path_chosen on the first successful kick-off, not on 409
    // re-entries — keeps the funnel honest.
    if (!alreadyInProgress) {
      void recordOnboardingEvent('path_chosen', { path: 'generate' })
    }
    // Story 25.2 (B.2): hand off to the parent shell to advance the modal to
    // the tutorial step. The modal-shell now owns minimise + close + route
    // (deferred to the Minimera affordance inside the tutorial step).
    onPickGenerate()
  }

  async function handleManual() {
    void recordOnboardingEvent('path_chosen', { path: 'manual' })
    if (
      !(await runDismissAction(minimiseFirstRunModal, 'minimiseFirstRunModal'))
    ) {
      return
    }
    onClose()
    router.push('/laglistor')
  }

  function handleImport() {
    void recordOnboardingEvent('path_chosen', { path: 'import' })
    onPickImport()
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Generera is the recommended path (top-left) — matches the prototype's
          AI-first framing. Mall demotes to a regular peer card. */}
      <PathCard
        recommended
        icon={WandSparkles}
        title="Generera ny lista"
        body="Vi tar fram en personlig laglista baserat på er bransch och verksamhet. Tar 2–5 minuter."
        cta={isGenerating ? 'Genererar…' : 'Använd er profil'}
        loading={isGenerating}
        onClick={handleGenerate}
        onKeyDown={(e) => handleCardKeyDown(e, handleGenerate)}
        data-onboarding-focus-target="true"
      />

      <PathCard
        icon={LayoutTemplate}
        title="Börja från mall"
        body="En kurerad startpunkt med 80–120 lagar för er bransch. Justera fritt efteråt."
        cta="Välj bransch"
        onClick={handleTemplate}
        onKeyDown={(e) => handleCardKeyDown(e, handleTemplate)}
      />

      <PathCard
        icon={Plus}
        title="Tom lista"
        body="Börja med en helt tom laglista och lägg till lagar manuellt. Bäst om ni vet exakt vad ni vill ha med."
        cta="Bygg från noll"
        onClick={handleManual}
        onKeyDown={(e) => handleCardKeyDown(e, handleManual)}
      />

      <PathCard
        icon={FileUp}
        title="Importera befintlig"
        body="Har du en lista i Excel, från Lex.nu eller en konsult? Vi matchar raderna mot vår katalog."
        cta=".xlsx · .csv · klistra in"
        onClick={handleImport}
        onKeyDown={(e) => handleCardKeyDown(e, handleImport)}
      />
    </div>
  )
}

interface PathCardProps {
  icon: LucideIcon
  title: string
  body: string
  cta: string
  recommended?: boolean
  loading?: boolean
  onClick: () => void
  onKeyDown: (_e: React.KeyboardEvent) => void
  ['data-onboarding-focus-target']?: string
}

function PathCard({
  icon: Icon,
  title,
  body,
  cta,
  recommended = false,
  loading = false,
  onClick,
  onKeyDown,
  ...rest
}: PathCardProps) {
  return (
    <div
      role="button"
      tabIndex={loading ? -1 : 0}
      aria-label={title}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? undefined : onClick}
      onKeyDown={loading ? undefined : onKeyDown}
      {...rest}
      className={cn(
        'group relative flex flex-col gap-4 rounded-2xl border p-6 outline-none transition-all',
        loading
          ? 'cursor-wait'
          : 'cursor-pointer hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        recommended
          ? 'border-foreground bg-foreground text-background hover:bg-foreground/95'
          : 'border-border bg-card text-card-foreground hover:border-foreground/30'
      )}
    >
      {recommended && (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-background">
          <WandSparkles className="h-3 w-3" aria-hidden="true" />
          Rekommenderas
        </span>
      )}

      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg',
          recommended
            ? 'bg-white/10 text-background'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 space-y-1.5">
        <p className="text-lg font-medium tracking-tight">{title}</p>
        <p
          className={cn(
            'text-sm leading-relaxed',
            recommended ? 'text-background/75' : 'text-muted-foreground'
          )}
        >
          {body}
        </p>
      </div>

      <div
        className={cn(
          'flex items-center gap-1.5 text-sm font-medium',
          recommended ? 'text-background' : 'text-foreground'
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        <span>{cta}</span>
        {!loading && (
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        )}
      </div>
    </div>
  )
}
