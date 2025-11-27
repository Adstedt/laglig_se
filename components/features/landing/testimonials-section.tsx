import { Star } from 'lucide-react'

interface Testimonial {
  quote: string
  metric: string
  metricLabel: string
  author: string
  role: string
  company: string
}

const testimonials: Testimonial[] = [
  {
    quote:
      'Vi undvek 200 000 kr i böter genom att få notis om en arbetsmiljöändring tre månader innan den trädde i kraft.',
    metric: '200k',
    metricLabel: 'sparat i böter',
    author: 'Erik Bergström',
    role: 'Produktionschef',
    company: 'Nordic Manufacturing',
  },
  {
    quote:
      'Från 10 timmar i månaden på lagbevakning till praktiskt taget noll. AI:n svarar på sekunder.',
    metric: '10h',
    metricLabel: 'sparade per månad',
    author: 'Anna Lindberg',
    role: 'VD',
    company: 'TechStart AB',
  },
  {
    quote:
      'HR-modulen flaggade 4 truckcertifikat som höll på att gå ut. Det hade vi aldrig upptäckt själva.',
    metric: '100%',
    metricLabel: 'compliance i audit',
    author: 'Marcus Johansson',
    role: 'HR-chef',
    company: 'Bygg & Montage',
  },
]

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
      ))}
    </div>
  )
}

export function TestimonialsSection() {
  return (
    <section className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-16">
          <h2
            className="font-safiro mb-4 text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            De hade inte tid att bevaka heller
          </h2>
          <p className="text-lg text-muted-foreground">
            Nu slipper de. Så här gick det.
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.author}
                className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
              >
                {/* Subtle gradient on hover */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative">
                  {/* Metric highlight - larger, more impactful */}
                  <div className="mb-5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-5 text-center">
                    <p
                      className="text-4xl font-bold tracking-tight text-primary"
                      style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                    >
                      {testimonial.metric}
                    </p>
                    <p className="mt-1 text-xs font-medium text-primary/70">
                      {testimonial.metricLabel}
                    </p>
                  </div>

                  {/* Quote */}
                  <blockquote className="mb-6 flex-1">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                  </blockquote>

                  {/* Author */}
                  <div className="border-t pt-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/50 text-sm font-semibold shadow-sm">
                        {testimonial.author
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {testimonial.author}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {testimonial.role}, {testimonial.company}
                        </p>
                      </div>
                    </div>
                    <StarRating />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
