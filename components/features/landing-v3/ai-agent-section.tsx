import {
  Sparkles,
  FileSearch,
  ListPlus,
  Network,
  Radar,
  BookOpen,
  GitCompare,
  PencilLine,
  Paperclip,
  ArrowRight,
} from 'lucide-react'

// The loop — what the AI does on its own, without being asked.
const chain = [
  {
    icon: Radar,
    title: 'Håller koll',
    desc: 'Bevakar nya och ändrade lagar varje dag – så ni slipper.',
  },
  {
    icon: BookOpen,
    title: 'Läser',
    desc: 'Går igenom ändringen och ser vad som faktiskt är nytt.',
  },
  {
    icon: GitCompare,
    title: 'Kollar',
    desc: 'Ser om ändringen påverkar just ert företag.',
  },
  {
    icon: PencilLine,
    title: 'Förbereder',
    desc: 'Skapar färdiga uppgifter med datum och allt – klara att godkänna.',
  },
  {
    icon: Paperclip,
    title: 'Tipsar',
    desc: 'Säger vilka papper och intyg ni behöver spara som bevis.',
  },
]

// What you actually get — concrete, in the AI's own voice.
const jobs = [
  {
    icon: FileSearch,
    title: 'Förklarar vad en lagändring betyder för er',
    example:
      '"AFS 2024:1 är ny. För er som konsultbolag med distansarbete betyder det skärpta krav på riskbedömning av arbetsmiljön. Era rutiner från 2023 täcker inte det här."',
  },
  {
    icon: ListPlus,
    title: 'Förbereder uppgifter, datum och bevis',
    example:
      '"Här är 3 uppgifter kopplade till AFS 2024:1, med datum satta efter när den börjar gälla, och förslag på vad ni behöver spara. Klicka för att lägga till."',
  },
  {
    icon: Network,
    title: 'Hjälper er svara när revisorn frågar',
    example:
      '"Kravet i AFS 2001:1 §8 uppfylldes 12 mars 2026 genom rutinen SAM-rutin v3.1 (godkänd av Anna S.) och ett kursintyg från 2026-02-14. Här är hela kedjan."',
  },
]

export function AiAgentSection() {
  return (
    <section className="relative overflow-hidden bg-foreground py-20 text-background md:py-28">
      <div className="absolute -top-40 right-0 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="absolute -bottom-40 left-0 h-80 w-80 rounded-full bg-background/[0.04] blur-3xl" />

      <div className="container relative mx-auto px-4">
        {/* Header */}
        <div className="mx-auto mb-14 max-w-3xl text-center md:mb-20">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-background/15 bg-background/5 px-3.5 py-1.5 text-xs font-medium"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            <Sparkles className="h-3 w-3" />
            <span>Drivs av Claude · jobbar varje dag</span>
          </div>
          <h2
            className="mb-5 text-3xl font-medium tracking-tight md:text-5xl lg:text-6xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            AI:n gör grovjobbet.
            <br />
            Ni bestämmer.
          </h2>
          <p className="text-lg opacity-75 md:text-xl">
            Det här är ingen vanlig chatt. Det är en AI som faktiskt gör jobbet
            – håller koll på nya lagar, förstår vad de betyder för just er, och
            förbereder allt så ni bara behöver säga ja.
          </p>
        </div>

        {/* The agentic chain */}
        <div className="mx-auto mb-8 max-w-6xl">
          <div className="grid gap-3 md:grid-cols-5">
            {chain.map((step, i) => (
              <div key={step.title} className="relative">
                {i < chain.length - 1 && (
                  <div className="absolute right-[-13px] top-9 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-background/20 bg-foreground md:flex">
                    <ArrowRight className="h-3 w-3 opacity-60" />
                  </div>
                )}
                <div className="flex h-full flex-col rounded-2xl border border-background/10 bg-background/[0.04] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/10">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span
                      className="text-xs font-medium opacity-40"
                      style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                    >
                      0{i + 1}
                    </span>
                  </div>
                  <h3
                    className="mb-1.5 text-base font-semibold"
                    style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-xs leading-relaxed opacity-65">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Human-in-control line */}
          <div className="mt-5 flex items-center justify-center">
            <p className="rounded-full border border-background/15 bg-background/5 px-4 py-2 text-sm opacity-80">
              AI:n gör aldrig något på egen hand – ni godkänner alltid först.
            </p>
          </div>
        </div>

        {/* What you get — concrete examples */}
        <div className="mx-auto max-w-6xl">
          <p
            className="mb-4 text-center text-xs font-medium uppercase tracking-[0.15em] opacity-50"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Vad ni får hjälp med
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {jobs.map((job) => (
              <div
                key={job.title}
                className="flex flex-col rounded-2xl border border-background/10 bg-background/[0.04] p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                  <job.icon className="h-5 w-5" />
                </div>
                <h3
                  className="mb-3 text-base font-semibold"
                  style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                >
                  {job.title}
                </h3>
                <div className="rounded-lg border border-dashed border-background/20 bg-background/5 p-3">
                  <p className="text-xs italic leading-relaxed opacity-75">
                    {job.example}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm opacity-55">
            Varje svar visar exakt vilken lag och paragraf det bygger på.
          </p>
        </div>
      </div>
    </section>
  )
}
