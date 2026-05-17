import {
  MapPin,
  History,
  Activity,
  Eye,
  ClipboardCheck,
  Lock,
  RefreshCw,
  KeyRound,
} from 'lucide-react'

const facts = [
  {
    icon: MapPin,
    title: 'Data lagras i Sverige',
    desc: 'Era uppgifter stannar i Sverige – och lämnar aldrig EU.',
  },
  {
    icon: History,
    title: 'Allt sparas, inget försvinner',
    desc: 'Rutiner, dokument och ändringar sparas med full historik.',
  },
  {
    icon: Activity,
    title: 'Ni ser vem som gjort vad',
    desc: 'Varje ändring loggas med tid och person. Inget faller mellan stolarna.',
  },
  {
    icon: Eye,
    title: 'Egen inloggning för revisorn',
    desc: 'Revisorn kan läsa allt som behövs – men ändrar ingenting.',
  },
  {
    icon: ClipboardCheck,
    title: 'Strukturerade genomgångar',
    desc: 'Anmärkningar och åtgärder, organiserat och lätt att följa.',
  },
  {
    icon: RefreshCw,
    title: 'Uppdateras varje dag',
    desc: 'Nya lagar och ändringar fångas upp automatiskt – ni behöver inte leta.',
  },
  {
    icon: Lock,
    title: 'GDPR från grunden',
    desc: 'Krypterat, säkert, och personuppgiftsbiträdesavtal som standard.',
  },
  {
    icon: KeyRound,
    title: 'Var och en ser sitt',
    desc: 'Olika roller för ägare, medarbetare och revisor – alla ser rätt saker.',
  },
]

export function InfrastructureSection() {
  return (
    <section className="border-y bg-section-sage py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <h2
            className="mb-4 text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Tryggt, säkert
            <br className="hidden sm:block" /> och spårbart.
          </h2>
          <p className="text-lg text-muted-foreground md:text-xl">
            Allt det här finns på plats redan idag. Det vi inte har än är vi
            ärliga med.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <div
              key={fact.title}
              className="rounded-2xl border bg-card p-5 transition-all hover:border-foreground/30 hover:shadow-sm"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
                <fact.icon className="h-4 w-4" />
              </div>
              <h3
                className="mb-1.5 text-sm font-semibold"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                {fact.title}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {fact.desc}
              </p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
          Vi skyltar inte med certifieringar vi inte har. ISO 27001 och
          inloggning med BankID är på gång – men inte klart än.
        </p>
      </div>
    </section>
  )
}
