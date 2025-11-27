import {
  FileText,
  Users,
  CheckSquare,
  MessageSquare,
  ArrowRight,
  Bell,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'

const workflowSteps = [
  {
    icon: FileText,
    label: 'Lagändring upptäcks',
    title: 'Ny lag träder i kraft',
    description: 'AFS 2024:1 om systematiskt arbetsmiljöarbete',
    color: 'amber',
    badge: '08:00',
  },
  {
    icon: Users,
    label: 'Anställda identifieras',
    title: '3 personer påverkas',
    description: 'Lisa (lager), Erik (produktion), Anna (HR)',
    color: 'primary',
    badge: '08:01',
  },
  {
    icon: CheckSquare,
    label: 'Uppgifter skapas',
    title: 'Åtgärder tilldelas',
    description: 'Utbildning, dokumentation, rutinuppdatering',
    color: 'emerald',
    badge: '08:02',
  },
  {
    icon: MessageSquare,
    label: 'AI ger vägledning',
    title: 'Fråga vad som helst',
    description: '"Vilka certifikat behöver Lisa för lagerarbete?"',
    color: 'violet',
    badge: 'När som helst',
  },
]

const colorClasses = {
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
  },
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    dot: 'bg-primary',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  violet: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
    border: 'border-violet-500/20',
    dot: 'bg-violet-500',
  },
}

export function WorkflowSection() {
  return (
    <section id="workflow" className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <Badge variant="outline" className="mb-4">
            <Bell className="mr-2 h-3 w-3" />
            Så fungerar det i praktiken
          </Badge>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            En vanlig morgon med Laglig.se
          </h2>
          <p className="text-lg text-muted-foreground">
            Se hur en lagändring automatiskt blir till konkreta åtgärder för
            rätt personer i ditt team
          </p>
        </div>

        {/* Workflow timeline */}
        <div className="relative mx-auto max-w-4xl">
          {/* Connection line - desktop */}
          <div className="absolute left-8 top-0 hidden h-full w-px bg-gradient-to-b from-border via-border to-transparent md:left-1/2 md:block" />

          <div className="space-y-8 md:space-y-0">
            {workflowSteps.map((step, index) => {
              const colors =
                colorClasses[step.color as keyof typeof colorClasses]
              const isEven = index % 2 === 0

              return (
                <div
                  key={step.label}
                  className={`relative flex flex-col md:flex-row ${
                    isEven ? 'md:flex-row' : 'md:flex-row-reverse'
                  } md:items-center`}
                >
                  {/* Timeline dot - mobile */}
                  <div className="absolute left-8 top-0 flex h-4 w-4 -translate-x-1/2 items-center justify-center md:hidden">
                    <div className={`h-3 w-3 rounded-full ${colors.dot}`} />
                  </div>

                  {/* Content card */}
                  <div
                    className={`ml-16 md:ml-0 md:w-1/2 ${isEven ? 'md:pr-12' : 'md:pl-12'}`}
                  >
                    <div
                      className={`rounded-xl border ${colors.border} bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md`}
                    >
                      {/* Step header */}
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors.bg}`}
                          >
                            <step.icon className={`h-5 w-5 ${colors.text}`} />
                          </div>
                          <span
                            className={`text-sm font-medium ${colors.text}`}
                          >
                            {step.label}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {step.badge}
                        </Badge>
                      </div>

                      {/* Step content */}
                      <h3 className="mb-2 text-lg font-semibold">
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Timeline dot - desktop */}
                  <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:flex">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-4 border-background ${colors.dot}`}
                    />
                  </div>

                  {/* Spacer for alternating layout */}
                  <div className="hidden md:block md:w-1/2" />
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-6 py-3">
            <span className="text-sm text-muted-foreground">
              Från lagändring till åtgärd
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">helt automatiskt</span>
          </div>
        </div>
      </div>
    </section>
  )
}
