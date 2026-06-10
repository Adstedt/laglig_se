import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Browser-style chrome around real in-app screenshots (Story 26.1 AC 16).
 *
 * The marketing pages sell product depth with actual product surfaces —
 * this frame makes a raw screenshot read as "the app", matching the
 * landing-v3 card language (rounded, hairline border, soft shadow on cream).
 * Use inside <SplitFeature>/<MarketingHero> media slots or directly in MDX.
 */
export function ScreenshotFrame({
  src,
  alt,
  width = 1200,
  height = 800,
  priority = false,
  className,
}: {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  className?: string
}) {
  return (
    <figure
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border/70 bg-secondary/40 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
      </div>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes="(max-width: 768px) 100vw, 50vw"
        className="w-full"
      />
    </figure>
  )
}
