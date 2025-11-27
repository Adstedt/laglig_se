export function LogoCloudSection() {
  // Real trust indicators - social proof that builds credibility
  const trustPoints = [
    'Används av 1 000+ svenska företag',
    'Från 1 anställd till 500+',
    'Alla branscher',
  ]

  return (
    <section className="border-y bg-muted/30 py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
          {trustPoints.map((point, index) => (
            <div key={point} className="flex items-center gap-2">
              {index > 0 && (
                <span className="hidden text-border md:inline">•</span>
              )}
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
