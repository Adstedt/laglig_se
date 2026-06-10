import Image from 'next/image'

/**
 * Quote / metric proof section. Quiet sage-tinted band — the one place the
 * muted section background is allowed (never as a foreground accent).
 */
export function ProofBlock({
  quote,
  attribution,
  role,
  metric,
  logoSrc,
}: {
  quote: string
  attribution: string
  role?: string | undefined
  metric?: { value: string; label: string } | undefined
  logoSrc?: string | undefined
}) {
  return (
    <section className="bg-[hsl(var(--section-sage,140_25%_95%))]">
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          {metric && (
            <p className="mb-6">
              <span className="font-safiro text-5xl font-medium text-foreground">
                {metric.value}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {metric.label}
              </span>
            </p>
          )}
          <blockquote className="font-safiro text-xl font-medium leading-snug tracking-tight text-foreground md:text-2xl">
            “{quote}”
          </blockquote>
          <div className="mt-6 flex items-center justify-center gap-3">
            {logoSrc && (
              <Image
                src={logoSrc}
                alt={attribution}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
            )}
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{attribution}</span>
              {role && <span> · {role}</span>}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
