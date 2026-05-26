'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Search,
  Globe,
  Shield,
  Check,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

export function OrgCheckForm({ className }: { className?: string }) {
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

  return (
    <div className={cn('w-full', className)}>
      {!preview &&
        (step === 1 ? (
          <form onSubmit={goNext}>
            <div className={pill}>
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Organisationsnummer (XXXXXX-XXXX)"
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
            <p className="mt-2.5 pl-1 text-xs text-muted-foreground">
              Se direkt vilka regler som gäller — på 30 sekunder.
            </p>
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

      {/* Result */}
      <div
        aria-live="polite"
        className={cn(
          'overflow-hidden transition-all duration-500 ease-out',
          preview ? 'mt-4 max-h-[680px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        {preview && (
          <div className="rounded-2xl border border-border bg-card text-left shadow-sm">
            <div className="flex items-start justify-between gap-3 p-5 pb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold leading-tight">
                  {preview.company.name}
                </h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {preview.company.legalForm && (
                    <span>{preview.company.legalForm}</span>
                  )}
                  {preview.company.municipality && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{preview.company.municipality}</span>
                    </>
                  )}
                </div>
                {preview.companySummary && (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {preview.companySummary}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreview(null)
                  setStep(1)
                }}
                className="shrink-0 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                Sök på nytt
              </button>
            </div>

            <div className="border-t border-border bg-muted/30 px-5 py-4">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">
                  Minst{' '}
                  <span className="text-base font-bold text-primary">
                    {preview.areaCount}
                  </span>{' '}
                  regelområden kan beröra er verksamhet
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preview.areas.slice(0, MAX_VISIBLE_BADGES).map((area) => (
                  <Badge key={area} variant="secondary" className="text-xs">
                    {area}
                  </Badge>
                ))}
                {preview.areas.length > MAX_VISIBLE_BADGES && (
                  <Badge variant="outline" className="text-xs">
                    +{preview.areas.length - MAX_VISIBLE_BADGES} till…
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-5 pt-4">
              <Button asChild size="lg" className="w-full">
                <Link href={ctaUrl}>
                  Kom igång gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
