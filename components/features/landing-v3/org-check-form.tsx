'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Search,
  Globe,
  Check,
  Sparkles,
  ShieldCheck,
  MapPin,
  Building2,
  Lock,
  Calculator,
  Scale,
  Receipt,
  Percent,
  Users,
  FlaskConical,
  Flame,
  Leaf,
  BookMarked,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Stepped org-number conversion form for landing-v3.
 *
 * Step 1 — one simple row: enter the organisation number → "Nästa".
 * Step 2 — optionally add a website URL → "Visa min översikt" (fetches the
 *          public company preview and reveals the regulatory-area result).
 *
 * Designed to live high on the page (compact, in the hero) and also stand in
 * for the old two-field widget further down. The shared `HeroPreview` (used by
 * the live landing page) is intentionally left untouched.
 */

interface PreviewResponse {
  company: {
    name: string
    orgNumber: string
    legalForm: string | null
    address: string | null
    municipality: string | null
    sniCode: string | null
    industry: string | null
  }
  areas: string[]
  areaCount: number
  inferredFlags: Record<string, boolean>
  companySummary: string | null
}

const MAX_VISIBLE_BADGES = 6

function formatOrgNumber(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 10)
  if (digits.length > 6) return `${digits.slice(0, 6)}-${digits.slice(6)}`
  return digits
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

// Map a regulatory area to a representative icon so the preview reads as the
// product's own intelligence rather than a flat list of tags.
function iconForArea(area: string): LucideIcon {
  const a = area.toLowerCase()
  if (a.includes('gdpr') || a.includes('dataskydd') || a.includes('personuppg'))
    return Lock
  if (a.includes('bokför') || a.includes('redovis')) return Calculator
  if (a.includes('bolag') || a.includes('aktie')) return Scale
  if (a.includes('moms') || a.includes('mervärde')) return Percent
  if (a.includes('skatt')) return Receipt
  if (a.includes('arbets')) return Users
  if (a.includes('kemik')) return FlaskConical
  if (a.includes('brand')) return Flame
  if (a.includes('miljö')) return Leaf
  return BookMarked
}

export function OrgCheckForm({
  className,
  eyebrow,
  resultMode = 'inline',
}: {
  className?: string
  eyebrow?: string
  /** how the preview result is surfaced: revealed in place (`inline`, default)
   *  or in a modal (`modal`) — used in the hero so the result doesn't balloon
   *  the form column and break the surrounding layout */
  resultMode?: 'inline' | 'modal'
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [orgNumber, setOrgNumber] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<'not_found' | 'unavailable' | null>(null)

  const orgReady = orgNumber.replace(/\D/g, '').length === 10

  const goNext = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (orgReady) setStep(2)
    },
    [orgReady]
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!orgReady) return
      setIsLoading(true)
      setError(null)
      setPreview(null)
      try {
        const body: { orgNumber: string; websiteUrl?: string } = {
          orgNumber: orgNumber.trim(),
        }
        const url = normalizeUrl(websiteUrl)
        if (url) body.websiteUrl = url

        const res = await fetch('/api/public/company-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.status === 404) {
          setError('not_found')
          return
        }
        if (!res.ok) {
          setError('unavailable')
          return
        }
        const data = await res.json()
        if (
          data &&
          typeof data === 'object' &&
          data.company &&
          Array.isArray(data.areas)
        ) {
          setPreview(data as PreviewResponse)
        }
      } catch {
        setError('unavailable')
      } finally {
        setIsLoading(false)
      }
    },
    [orgNumber, websiteUrl, orgReady]
  )

  const reset = useCallback(() => {
    setPreview(null)
    setStep(1)
    setError(null)
  }, [])

  const ctaUrl = preview
    ? `/signup?org=${encodeURIComponent(preview.company.orgNumber)}${
        websiteUrl.trim()
          ? `&url=${encodeURIComponent(normalizeUrl(websiteUrl))}`
          : ''
      }`
    : '/signup'

  const pill =
    'flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-4 pr-1.5 shadow-sm transition focus-within:border-foreground/20 focus-within:ring-4 focus-within:ring-foreground/[0.06]'
  const field =
    'min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground'
  const action =
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'

  // The company-preview "payoff" card — rendered inline (try-now section) or
  // inside a modal (hero). As a modal it lives outside the page flow, so the
  // hero's form column never balloons when the result appears.
  const result = preview && (
    <div
      className={cn(
        'relative text-left',
        resultMode === 'inline' &&
          'overflow-hidden rounded-2xl border border-border bg-card shadow-sm'
      )}
    >
      {resultMode === 'inline' && (
        <button
          type="button"
          onClick={reset}
          className="absolute right-4 top-4 z-10 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          Sök på nytt
        </button>
      )}

      {/* identity — soft warm wash so the header reads as a branded surface */}
      <div className="bg-gradient-to-b from-secondary/60 to-transparent px-5 pb-4 pt-5">
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-amber-500" />
          Din regelöversikt
        </p>
        <div
          className={cn(
            'flex items-start gap-3',
            resultMode === 'modal' && 'pr-6'
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground font-safiro text-lg font-medium text-background">
            {preview.company.name.trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-safiro text-lg font-medium leading-tight">
              {preview.company.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {preview.company.legalForm && (
                <span className="inline-flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 ring-1 ring-border/60">
                  <Building2 className="h-3 w-3" />
                  {preview.company.legalForm}
                </span>
              )}
              {preview.company.municipality && (
                <span className="inline-flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 ring-1 ring-border/60">
                  <MapPin className="h-3 w-3" />
                  {preview.company.municipality}
                </span>
              )}
            </div>
          </div>
        </div>
        {preview.companySummary && (
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            {preview.companySummary}
          </p>
        )}
      </div>

      {/* regelområden — the payoff */}
      <div className="border-t border-border/70 px-5 py-4">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <p className="text-sm leading-snug">
            Minst{' '}
            <span className="font-safiro text-base font-medium text-foreground">
              {preview.areaCount}
            </span>{' '}
            regelområden kan beröra er verksamhet
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {preview.areas.slice(0, MAX_VISIBLE_BADGES).map((area) => {
            const Icon = iconForArea(area)
            return (
              <span
                key={area}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/70 px-2.5 py-1.5 text-[12.5px] font-medium text-foreground/80 ring-1 ring-border/50"
              >
                <Icon className="h-3.5 w-3.5 text-foreground/45" />
                {area}
              </span>
            )
          })}
          {preview.areas.length > MAX_VISIBLE_BADGES && (
            <span className="inline-flex items-center rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-muted-foreground">
              +{preview.areas.length - MAX_VISIBLE_BADGES} till
            </span>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-5 pt-1">
        <Button asChild size="lg" className="w-full">
          <Link href={ctaUrl}>
            Testa gratis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          Gratis i 15 dagar · inget betalkort krävs
        </p>
      </div>
    </div>
  )

  return (
    <div className={cn('w-full', className)}>
      {(resultMode === 'modal' || !preview) &&
        (step === 1 ? (
          <form onSubmit={goNext}>
            {eyebrow && (
              <p className="mb-2.5 flex items-center gap-1.5 pl-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/70 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-600" />
                </span>
                {eyebrow}
              </p>
            )}
            <div className={pill}>
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Organisationsnummer"
                value={orgNumber}
                onChange={(e) => setOrgNumber(formatOrgNumber(e.target.value))}
                maxLength={11}
                aria-label="Organisationsnummer"
                className={field}
              />
              <button type="submit" disabled={!orgReady} className={action}>
                Nästa
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {!eyebrow && (
              <p className="mt-2.5 pl-1 text-xs text-muted-foreground">
                Se direkt vilka regler som gäller — på 30 sekunder.
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-2 flex items-center gap-2 pl-1 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" />
                Tillbaka
              </button>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Check className="h-3 w-3 text-emerald-600" />
                {orgNumber}
              </span>
            </div>
            <div className={pill}>
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                placeholder="Webbplats (valfritt)"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                aria-label="Webbplats"
                autoFocus
                className={field}
              />
              <button type="submit" disabled={isLoading} className={action}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyserar…
                  </>
                ) : (
                  <>
                    Visa min översikt
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
            <p className="mt-2.5 pl-1 text-xs text-muted-foreground">
              Frivilligt — ger en mer träffsäker bild av just er verksamhet.
            </p>
            {error && (
              <p className="mt-2 pl-1 text-sm text-destructive">
                {error === 'not_found'
                  ? 'Inget företag hittades med detta organisationsnummer.'
                  : 'Tjänsten är tillfälligt otillgänglig. Försök igen om en stund.'}
              </p>
            )}
          </form>
        ))}

      {/* Result — modal (hero) keeps it out of the page flow so the layout
          doesn't shift; inline (try-now) reveals it in place */}
      {resultMode === 'modal' ? (
        <Dialog
          open={!!preview}
          onOpenChange={(open) => {
            if (!open) reset()
          }}
        >
          <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
            <DialogTitle className="sr-only">
              {preview
                ? `Regelöversikt för ${preview.company.name}`
                : 'Regelöversikt'}
            </DialogTitle>
            {result}
          </DialogContent>
        </Dialog>
      ) : (
        <div
          aria-live="polite"
          className={cn(
            'overflow-hidden transition-all duration-500 ease-out',
            preview ? 'mt-4 max-h-[680px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          {result}
        </div>
      )}
    </div>
  )
}
