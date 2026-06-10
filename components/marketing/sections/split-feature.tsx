import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ScreenshotFrame } from '@/components/marketing/media/screenshot-frame'

/**
 * The Fieldly-style workhorse (Story 26.1 AC 6): an alternating media + copy
 * row that showcases product depth with a real surface next to the claim.
 * Compose several in sequence and alternate `mediaSide` per row.
 */
const TINT_CLASS = {
  warm: 'bg-section-warm',
  sage: 'bg-section-sage',
  none: '',
} as const

export function SplitFeature({
  eyebrow,
  title,
  children,
  media,
  mediaSide = 'left',
  tint = 'warm',
}: {
  eyebrow?: string | undefined
  title: string
  /** copy column content — MDX children or plain <p>s */
  children: React.ReactNode
  media: { type: 'screenshot' | 'photo'; src: string; alt: string }
  mediaSide?: 'left' | 'right'
  /** full-bleed background band so product rows read as distinct chapters
   *  against the cream prose (Story 26.4) */
  tint?: 'warm' | 'sage' | 'none'
}) {
  const mediaEl =
    media.type === 'screenshot' ? (
      <ScreenshotFrame src={media.src} alt={media.alt} />
    ) : (
      <Image
        src={media.src}
        alt={media.alt}
        width={1200}
        height={900}
        sizes="(max-width: 1024px) 100vw, 50vw"
        // Photo treatment (not a screenshot): no hard border — a soft shadow
        // + subtle ring define the edge cleanly, including on tinted bands.
        className="aspect-[4/3] w-full rounded-2xl object-cover shadow-md ring-1 ring-black/5"
      />
    )

  return (
    <section className={cn('mt-12 px-4 py-14 md:py-20', TINT_CLASS[tint])}>
      {/* Constrained narrower than the full container so the media doesn't
          dominate next to short copy (Story 26.4). Wider than prose
          (max-w-3xl) so it still reads as a breakout row. */}
      <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div className={cn(mediaSide === 'right' && 'lg:order-2')}>
          {mediaEl}
        </div>
        <div className={cn(mediaSide === 'right' && 'lg:order-1')}>
          {eyebrow && (
            <p className="mb-3 font-safiro text-[13px] font-medium text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h2 className="font-safiro text-2xl font-medium tracking-tight text-foreground md:text-3xl">
            {title}
          </h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}
