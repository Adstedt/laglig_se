'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, Search, Globe, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

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

export function HeroPreview() {
  const [orgNumber, setOrgNumber] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<'not_found' | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!orgNumber.trim()) return

      setIsLoading(true)
      setError(null)
      setPreview(null)

      try {
        const body: { orgNumber: string; websiteUrl?: string } = {
          orgNumber: orgNumber.trim(),
        }
        const normalizedUrl = normalizeUrl(websiteUrl)
        if (normalizedUrl) {
          body.websiteUrl = normalizedUrl
        }

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
          // 503 or other error — silent degradation (AC 23)
          return
        }

        const data = await res.json()
        // Validate response shape before setting state
        if (
          data &&
          typeof data === 'object' &&
          data.company &&
          Array.isArray(data.areas)
        ) {
          setPreview(data as PreviewResponse)
        }
      } catch {
        // Network error — silent degradation (AC 23)
      } finally {
        setIsLoading(false)
      }
    },
    [orgNumber, websiteUrl]
  )

  const ctaUrl = preview
    ? `/signup?org=${encodeURIComponent(preview.company.orgNumber)}${
        websiteUrl.trim()
          ? `&url=${encodeURIComponent(normalizeUrl(websiteUrl))}`
          : ''
      }${
        Object.keys(preview.inferredFlags).length > 0
          ? `&flags=${encodeURIComponent(
              Object.entries(preview.inferredFlags)
                .filter(([, v]) => v)
                .map(([k]) => k)
                .join(',')
            )}`
          : ''
      }${
        preview.companySummary
          ? `&summary=${encodeURIComponent(preview.companySummary)}`
          : ''
      }`
    : '/signup'

  const hasUrlAnalysis = websiteUrl.trim().length > 0 && preview?.companySummary

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Organisationsnummer (XXXXXX-XXXX)"
              value={orgNumber}
              onChange={(e) => setOrgNumber(formatOrgNumber(e.target.value))}
              className="h-12 pl-10 text-base"
              aria-label="Organisationsnummer"
              maxLength={11}
              required
            />
          </div>
          {error === 'not_found' && (
            <p className="text-sm text-destructive">
              Inget företag hittades med detta organisationsnummer
            </p>
          )}
        </div>

        <div className="relative">
          <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Webbplats (valfritt)"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="h-12 pl-10 text-base"
            aria-label="Webbplats"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
          disabled={isLoading || !orgNumber.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyserar...
            </>
          ) : (
            'Visa min översikt'
          )}
        </Button>
      </form>

      {/* Preview card with smooth transition */}
      <div
        ref={previewRef}
        aria-live="polite"
        className={`overflow-hidden transition-all duration-500 ease-out ${
          preview ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {preview && (
          <div className="rounded-xl border bg-card shadow-sm">
            {/* Company header */}
            <div className="p-5 pb-4">
              <h3 className="text-lg font-semibold">{preview.company.name}</h3>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {preview.company.legalForm && (
                  <span>{preview.company.legalForm}</span>
                )}
                {preview.company.municipality && (
                  <>
                    <span aria-hidden="true">·</span>
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

            {/* Regulatory areas — visually distinct section */}
            <div className="border-t bg-muted/30 px-5 py-4">
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
                    +{preview.areas.length - MAX_VISIBLE_BADGES} till...
                  </Badge>
                )}
              </div>
              {hasUrlAnalysis && (
                <p className="mt-2.5 text-xs text-muted-foreground">
                  Baserat på er webbplats och offentlig data
                </p>
              )}
            </div>

            {/* CTA — ties back to the result */}
            <div className="p-5 pt-4">
              <Button asChild className="w-full" size="lg">
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
