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
            Företag som sover gott om natten
          </h2>
          <p className="text-lg text-muted-foreground">
            Se hur andra har löst sin lagefterlevnad
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.author}
                className="card-hover flex flex-col rounded-2xl border bg-card p-6"
              >
                {/* Metric highlight */}
                <div className="mb-4 rounded-xl bg-primary/5 p-4 text-center">
                  <p className="text-3xl font-bold tracking-tight text-primary">
                    {testimonial.metric}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {testimonial.author
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
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
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
