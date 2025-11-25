import { Building2 } from 'lucide-react'

export function PartnersSection() {
  // Placeholder company names - will be replaced with actual logos
  const partners = [
    'Volvo',
    'Ericsson',
    'H&M',
    'IKEA',
    'Spotify',
    'Klarna',
    'Northvolt',
    'Scania',
  ]

  return (
    <section className="border-y bg-muted/30 py-12">
      <div className="container mx-auto px-4">
        <p className="mb-8 text-center text-sm font-medium text-muted-foreground">
          Används av anställda på:
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {partners.map((partner) => (
            <div
              key={partner}
              className="flex h-12 w-24 items-center justify-center rounded-lg bg-muted/50"
            >
              {/* Placeholder for company logo */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="text-xs font-medium">{partner}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
