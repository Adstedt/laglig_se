'use client'

/**
 * Lagändringar showcase body — a static render of the change-assessment chat
 * modal mid-assessment. Mirrors `ChangeAssessmentModal` (Ändring badge + doc
 * header + chat thread + assessment resolution), but bespoke + static because
 * the real modal wraps a live streaming ChatPanel. The AI reply weaves in the
 * Nordviken company context (their laglista item, styrdokument and ansvarig).
 */
import {
  X,
  Sparkles,
  CheckCircle2,
  BookOpen,
  ArrowUp,
  Check,
} from 'lucide-react'
import type { PendingAgentAction } from '@prisma/client'
import { TaskApprovalRenderer } from '@/components/features/ai-chat/agent-action-renderers/task-approval-renderer'
import { noop } from './showcase-utils'

// The real 14.23 approval card (CREATE_TASK) is presentational — feed it a
// mocked PENDING action so the showcase shows the genuine agent-action card.
const TASK_ACTION = {
  id: 'pa-demo-1',
  status: 'PENDING',
  action_type: 'CREATE_TASK',
  params: {
    title: 'Upprätta utbildningsregister för serveringspersonal',
    description:
      'Skapa och underhåll ett register över vilka i personalen som genomgått utbildning i ansvarsfull alkoholservering, enligt nya 8 kap. 12 a §. Ansvarig: Anna Lindqvist. Klart senast 31 dec 2026.',
    priority: 'HIGH',
  },
  result_ref: null,
} as unknown as PendingAgentAction

export function ChangeAssessmentReal() {
  return (
    <div className="pointer-events-none select-none bg-muted/40 p-10 text-left">
      {/* modal card */}
      <div className="mx-auto flex max-w-[840px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="inline-flex items-center rounded-md bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">
            Ändring
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              Lag om ändring i alkohollagen (2010:1622)
            </p>
            <p className="text-xs text-muted-foreground">SFS 2026:412</p>
          </div>
          <X className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* chat thread */}
        <div className="space-y-5 px-5 py-6">
          {/* user auto-start */}
          <div className="flex justify-end">
            <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              Granska denna lagändring och bedöm hur den påverkar vår
              verksamhet.
            </div>
          </div>

          {/* assistant assessment */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>
                Läste ändringen, er laglista och era styrdokument · 3 s
              </span>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
              <p>
                Ändringen skärper kraven i 8 kap. och inför ett{' '}
                <span className="font-medium text-foreground">
                  nytt krav (12 a §)
                </span>{' '}
                på register över utbildad serveringspersonal. Så här påverkar
                det Nordviken:
              </p>
              <ul className="space-y-1.5 pl-1">
                {[
                  'Ert serveringstillstånd berörs direkt — ansvarig är Anna Lindqvist.',
                  'Er rutin "Ansvarsfull alkoholservering" (RUT-014) täcker utbildning, men saknar register.',
                  'Ny deadline: utbildningsregister ska finnas på plats senast 1 jan 2027.',
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                Källa:
                <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-foreground/70">
                  <BookOpen className="h-3 w-3" />
                  Alkohollag (2010:1622) · 8 kap. 12 a §
                </span>
              </p>

              {/* approval card — the real 14.23 agent-action card (CREATE_TASK) */}
              <TaskApprovalRenderer
                action={TASK_ACTION}
                onApprove={noop}
                onReject={noop}
                onParamsChange={noop}
                isSubmitting={false}
              />
            </div>
          </div>
        </div>

        {/* assessment resolution footer */}
        <div className="border-t border-border bg-muted/30 px-5 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Bedömning:
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-400/40">
                Påverkar oss — åtgärd krävs
              </span>
              <span className="rounded-full px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border">
                Påverkar inte
              </span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background">
              <Check className="h-3.5 w-3.5" />
              Spara bedömning
            </span>
          </div>
        </div>

        {/* input */}
        <div className="border-t border-border px-5 py-3">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
            Fråga om ändringen…
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ArrowUp className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
