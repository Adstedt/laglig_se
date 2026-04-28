'use client'

/**
 * Story 21.11 — Rapport tab.
 *
 * Status-branched client component. For PLANERAD | PAGAENDE it renders a
 * placeholder + skips the fetch entirely (conditional SWR key). For AVSLUTAD
 * (the only terminal active state post Story 21.27) it fetches the
 * pre-rendered HTML from `getRevisionsrapportInput` and renders it inside a
 * sandboxed iframe so the report's self-contained `<style>` block does not
 * leak into the parent app.
 *
 * `srcdoc` + auto-height-iframe is a new pattern in this codebase — no
 * existing precedent to mirror (verified by grep at story-draft time).
 */

import { useCallback, useRef, useState } from 'react'
import useSWR from 'swr'
import type { ComplianceCycleStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  getRevisionsrapportInput,
  type GetRevisionsrapportInputResult,
} from '@/app/actions/compliance-audit-report'

const IFRAME_HEIGHT_CAP_PX = 2000
const IFRAME_DEFAULT_HEIGHT_PX = 600

function previewKey(cycleId: string): string {
  return `revisionsrapport-preview:${cycleId}`
}

interface CycleRapportTabProps {
  cycleId: string
  cycleStatus: ComplianceCycleStatus
  cycleName: string
}

export function CycleRapportTab({
  cycleId,
  cycleStatus,
  cycleName,
}: CycleRapportTabProps) {
  // Story 21.26 — SEALED collapsed into AVSLUTAD; only the post-completion
  // states fetch a rapport.
  const shouldFetch = cycleStatus === 'AVSLUTAD'

  const swrKey = shouldFetch ? previewKey(cycleId) : null

  const { data, error, isLoading, mutate } =
    useSWR<GetRevisionsrapportInputResult>(
      swrKey,
      async () => {
        const result = await getRevisionsrapportInput({ cycleId })
        if (!result.success || !result.data) {
          throw new Error(result.error ?? 'Rapporten kunde inte genereras')
        }
        return result.data
      },
      {
        revalidateOnFocus: false,
        dedupingInterval: 30_000,
      }
    )

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [iframeHeight, setIframeHeight] = useState<number>(
    IFRAME_DEFAULT_HEIGHT_PX
  )

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const scrollHeight =
      iframe.contentDocument?.documentElement.scrollHeight ??
      IFRAME_DEFAULT_HEIGHT_PX
    setIframeHeight(Math.min(scrollHeight, IFRAME_HEIGHT_CAP_PX))
  }, [])

  // Pre-complete states: placeholder copy, no fetch.
  if (!shouldFetch) {
    return (
      <div className="p-6">
        <div className="rounded-md border bg-muted/30 p-6 text-sm text-muted-foreground">
          Rapport blir tillgänglig när kontrollen slutförs (AVSLUTAD). Du kan
          slutföra kontrollen via åtgärdsmenyn när samtliga poster är signerade.
        </div>
      </div>
    )
  }

  // Loading state: skeleton iframe-sized box.
  if (isLoading) {
    return (
      <div className="p-6">
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border bg-muted/30"
          style={{ height: IFRAME_DEFAULT_HEIGHT_PX }}
        >
          <span className="sr-only">Laddar revisionsrapport…</span>
        </div>
      </div>
    )
  }

  // Error state: inline card + retry.
  if (error || !data) {
    const message = error instanceof Error ? error.message : String(error ?? '')
    return (
      <div className="p-6">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">
            Rapporten kunde inte genereras
            {message ? `: ${message}` : ''}
          </p>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => mutate()}
            >
              Försök igen
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Story 21.26 — only one report kind remains (`complete`). The legacy
  // SEALED branch + emerald advisory copy went away with the SEAL collapse.

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">
            Revisionsrapport (förhandsvisning)
          </h3>
          {cycleStatus === 'AVSLUTAD' ? (
            <p className="text-xs text-muted-foreground">
              Första nedladdningen kan ta upp till 60 sekunder för större
              kontroller.
            </p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <a
            href={`/laglistor/kontroller/${cycleId}/rapport/pdf?kind=complete`}
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            Ladda ner PDF
          </a>
        </Button>
      </div>

      <iframe
        ref={iframeRef}
        title={`Revisionsrapport — ${cycleName}`}
        srcDoc={data.html}
        sandbox=""
        onLoad={handleIframeLoad}
        className="revisionsrapport-iframe w-full rounded-md border bg-white"
        style={{ height: iframeHeight }}
      />
    </div>
  )
}
