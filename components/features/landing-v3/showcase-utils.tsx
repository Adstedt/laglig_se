'use client'

import { useEffect, useRef, useState } from 'react'
import { Lock } from 'lucide-react'

/**
 * Shared chrome for the landing-v3 feature showcases.
 *
 * Each product surface (Efterlevnad, Lagändringar, Uppgifter, Styrdokument,
 * Kontroll) renders the REAL in-app component fed mocked data. Those components
 * lay out at a fixed desktop width, so we render them at their natural
 * `designWidth` and scale-to-fit the container — preserving real proportions
 * instead of reflowing cramped — inside a browser frame.
 */

/**
 * Browser-framed viewport that renders `children` at `designWidth` and scales
 * them down to fit the container. Never scales up past 1:1. The bottom bleeds
 * off behind a soft fade so tall content doesn't hard-cut.
 */
export function ScaledModalFrame({
  url,
  designWidth,
  children,
  maxHeight = 820,
}: {
  url: string
  designWidth: number
  children: React.ReactNode
  /** cap for the viewport height (px); content taller than this fades at the bottom */
  maxHeight?: number
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [contentH, setContentH] = useState(0)

  useEffect(() => {
    const vp = viewportRef.current
    const content = contentRef.current
    if (!vp || !content) return
    const update = () => {
      const s = Math.min(1, vp.clientWidth / designWidth)
      setScale(s)
      // measure the unscaled content, then convert to scaled px height
      setContentH(content.offsetHeight * s)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(vp)
    ro.observe(content)
    return () => ro.disconnect()
  }, [designWidth])

  // Auto-size the viewport to the (scaled) content height, capped at maxHeight,
  // so short surfaces aren't padded with dead space and only genuinely tall
  // content fades at the bottom.
  const height = contentH ? Math.min(contentH, maxHeight) : maxHeight
  const isClipped = contentH > maxHeight + 1

  return (
    <div
      className="overflow-hidden rounded-xl border border-border/70 bg-card ring-1 ring-foreground/[0.04]"
      style={{
        boxShadow: [
          '0 1px 2px 0 rgb(0 0 0 / 0.03)',
          '0 18px 40px -12px rgb(0 0 0 / 0.13)',
          '0 56px 100px -32px rgb(0 0 0 / 0.20)',
        ].join(', '),
      }}
    >
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <div className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-border/60">
          <Lock className="h-2.5 w-2.5" />
          {url}
        </div>
      </div>
      {/* viewport — children render at designWidth then scale to fit width */}
      <div
        ref={viewportRef}
        className="relative overflow-hidden transition-[height] duration-200"
        style={{ height }}
      >
        <div
          ref={contentRef}
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: designWidth, transform: `scale(${scale})` }}
        >
          {children}
        </div>
        {isClipped && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>
    </div>
  )
}

/**
 * Faint dot texture + warm amber ambient glow behind a showcase section.
 * Near-monochrome on cream with a single sparing amber accent (on-brand v3).
 */
export function ShowcaseAtmosphere() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, hsl(var(--foreground) / 0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage:
            'radial-gradient(ellipse 60% 55% at 50% 60%, black, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 60% 55% at 50% 60%, black, transparent 75%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[58%] h-[620px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-200/30 via-orange-100/15 to-transparent blur-3xl"
      />
    </>
  )
}

/** Shared no-op callbacks for read-only real components fed mock data. */
export const noop = () => {}
export const noopAsync = async () => {}
