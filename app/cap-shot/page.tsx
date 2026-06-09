'use client'

// TEMPORARY capture route for generating landing-v3 mobile static screenshots.
// Renders the hero shot + each showcase surface at scale 1 with stable ids so
// Playwright can screenshot them crisply. Delete this folder after capture.

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { HeroProductShot } from '@/components/features/landing-v3/hero-product-shot'
import { ScaledModalFrame } from '@/components/features/landing-v3/showcase-utils'
import { LawItemModalReal } from '@/components/features/landing-v3/law-item-modal-real'
import { ChangeAssessmentReal } from '@/components/features/landing-v3/change-assessment-real'
import { UppgifterReal } from '@/components/features/landing-v3/uppgifter-real'
import { StyrdokumentReal } from '@/components/features/landing-v3/styrdokument-real'
import { KontrollReal } from '@/components/features/landing-v3/kontroll-real'

const SURFACES = [
  {
    id: 'efterlevnad',
    url: 'app.laglig.se/laglistor',
    w: 1280,
    body: <LawItemModalReal docId="arbetsmiljolagen" />,
  },
  {
    id: 'lagandringar',
    url: 'app.laglig.se/lagar/andringar',
    w: 1280,
    body: <ChangeAssessmentReal />,
  },
  {
    id: 'uppgifter',
    url: 'app.laglig.se/uppgifter',
    w: 1280,
    body: <UppgifterReal />,
  },
  {
    id: 'styrdokument',
    url: 'app.laglig.se/workspace/styrdokument',
    w: 1340,
    body: <StyrdokumentReal />,
  },
  {
    id: 'kontroll',
    url: 'app.laglig.se/laglistor/kontroller',
    w: 1280,
    body: <KontrollReal />,
  },
]

export default function CaptureShotPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Dev-only tooling: regenerate mobile shots via
  // `node scripts/capture-landing-mobile-shots.mjs`. Never served in production.
  if (process.env.NODE_ENV === 'production') notFound()
  if (!mounted) return null

  return (
    <div style={{ background: '#fff', padding: 48 }}>
      <div
        id="cap-hero"
        style={{
          width: 1600,
          overflow: 'hidden',
          borderRadius: 20,
          boxShadow: '0 0 0 1px rgb(0 0 0 / 0.06)',
        }}
      >
        <HeroProductShot />
      </div>

      {SURFACES.map((s) => (
        <div
          key={s.id}
          id={`cap-${s.id}`}
          style={{ width: s.w, marginTop: 96 }}
        >
          <ScaledModalFrame url={s.url} designWidth={s.w}>
            {s.body}
          </ScaledModalFrame>
        </div>
      ))}
    </div>
  )
}
