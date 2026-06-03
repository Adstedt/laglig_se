import { MapPin, Lock, KeyRound } from 'lucide-react'

// Trust signals only — spårbarhet/historik (shown in the showcase + AI chapter)
// and the revisor access (owned by the Byråer section) are deliberately left
// out here to avoid repeating the same points a third time.
const facts = [
  {
    icon: MapPin,
    title: 'Data lagras i Sverige',
    desc: 'Era uppgifter stannar i Sverige – och lämnar aldrig EU.',
  },
  {
    icon: Lock,
    title: 'GDPR från grunden',
    desc: 'Krypterat, säkert, och personuppgiftsbiträdesavtal som standard.',
  },
  {
    icon: KeyRound,
    title: 'Var och en ser sitt',
    desc: 'Roller för ägare, medarbetare och externa granskare – alla ser rätt saker.',
  },
]

export function InfrastructureSection() {
  return (
    <section className="border-y bg-section-warm py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <h2
            className="mb-4 text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Tryggt och säkert.
          </h2>
          <p className="text-lg text-muted-foreground md:text-xl">
            Era uppgifter är trygga, och ni bestämmer vem som ser vad.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {facts.map((fact) => (
            <div
              key={fact.title}
              className="rounded-2xl border bg-card p-6 transition-all hover:border-foreground/30 hover:shadow-sm"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
                <fact.icon className="h-4 w-4" />
              </div>
              <h3
                className="mb-1.5 text-base font-semibold"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                {fact.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {fact.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
