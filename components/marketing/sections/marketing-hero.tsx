import Image from 'next/image'
import type { HeroMedia } from '@/lib/marketing/frontmatter-schemas'
import { ScreenshotFrame } from '@/components/marketing/media/screenshot-frame'

/**
 * Marketing-page hero: Safiro title + subtitle + CTA slot, optional media
 * column. Mirrors the landing-v3 hero treatment (cream ground, ink type,
 * amber reserved for the CTA itself — passed in via `cta`).
 */
export function MarketingHero({
  eyebrow,
  title,
  subtitle,
  cta,
  media,
}: {
  eyebrow: string
  title: string
  subtitle: string
  /** CTA slot — typically <CtaBlock placement="hero"> */
  cta: React.ReactNode
  media?: HeroMedia | undefined
}) {
  return (
    <section className="container mx-auto px-4 pb-16 pt-12 md:pb-24 md:pt-16">
      <div
        className={
          media
            ? 'grid items-center gap-10 lg:grid-cols-2 lg:gap-16'
            : 'mx-auto max-w-3xl text-center'
        }
      >
        <div>
          <p className="mb-4 font-safiro text-[13px] font-medium text-amber-700">
            {eyebrow}
          </p>
          <h1 className="font-safiro text-4xl font-medium tracking-tight text-foreground md:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
          <div className={media ? 'mt-8' : 'mt-8 flex justify-center'}>
            {cta}
          </div>
        </div>
        {media &&
          (media.type === 'screenshot' ? (
            <ScreenshotFrame src={media.src} alt={media.alt} priority />
          ) : (
            <Image
              src={media.src}
              alt={media.alt}
              width={1200}
              height={800}
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="w-full rounded-2xl border border-border object-cover shadow-sm"
            />
          ))}
      </div>
    </section>
  )
}
