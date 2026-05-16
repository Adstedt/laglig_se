'use client'

import * as React from 'react'
import { Briefcase, ShieldCheck, Users, Eye, Check } from 'lucide-react'

import { cn } from '@/lib/utils'

const roles = [
  {
    id: 'agare',
    icon: Briefcase,
    title: 'Ägare / VD',
    summary: 'Sov gott om natten.',
    points: [
      'Hela läget på en skärm – ni ser direkt om något halkar efter',
      'Risker sorterade efter hur allvarliga de är',
      'Allt finns dokumenterat – ni slipper leta när revisorn ringer',
      'Tydligt vem som ansvarar för vad',
    ],
  },
  {
    id: 'ansvarig',
    icon: ShieldCheck,
    title: 'Compliance-ansvarig',
    summary: 'Allt samlat, inget tappas bort.',
    points: [
      'Lagar, krav, uppgifter, dokument och genomgångar på ett ställe',
      'AI:n håller koll på nya lagar och föreslår vad ni ska göra',
      'Rutiner och policyer sparas med full historik',
      'Återkommande genomgångar med anmärkningar och åtgärder',
    ],
  },
  {
    id: 'hr',
    icon: Users,
    title: 'HR-chef',
    summary: 'Koll på arbetsmiljö och personal.',
    points: [
      'Arbetsmiljölagar med färdiga rutiner kopplade till sig',
      'Påminnelser innan certifikat och utbildningar går ut',
      'GDPR-koll på medarbetarnas uppgifter',
      'Fördela och följa upp uppgifter i HR-teamet',
    ],
  },
  {
    id: 'revisor',
    icon: Eye,
    title: 'Er revisor',
    summary: 'Får läsa allt – ändrar inget.',
    points: [
      'Egen inloggning – kan se allt, men ändrar ingenting',
      'Ser vem som gjort vad, och när',
      'Anmärkningar och åtgärder, snyggt strukturerat',
      'Kan klicka sig hela vägen ner till beviset',
    ],
  },
]

export function RolesSection() {
  const [activeId, setActiveId] = React.useState<string>('ansvarig')
  // roles is a hardcoded non-empty list, so roles[1] is always defined;
  // non-null assertion keeps `active` typed as Role (not Role | undefined)
  // under noUncheckedIndexedAccess.
  const active = roles.find((r) => r.id === activeId) ?? roles[1]!

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <h2
            className="mb-4 text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Funkar för hela företaget.
          </h2>
          <p className="text-lg text-muted-foreground md:text-xl">
            Alla på företaget ser det de behöver – varken mer eller mindre.
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          {/* Persona tabs */}
          <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
            {roles.map((role) => {
              const isActive = role.id === activeId
              return (
                <button
                  key={role.id}
                  onClick={() => setActiveId(role.id)}
                  className={cn(
                    'group flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                    isActive
                      ? 'border-foreground bg-foreground text-background shadow-md'
                      : 'border-border bg-card hover:border-foreground/40 hover:shadow-sm'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      isActive
                        ? 'bg-background/15 text-background'
                        : 'bg-muted text-muted-foreground group-hover:bg-foreground/10'
                    )}
                  >
                    <role.icon className="h-4 w-4" />
                  </div>
                  <span
                    className="text-sm font-semibold"
                    style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                  >
                    {role.title}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Active role detail */}
          <div className="rounded-2xl border bg-card p-6 md:p-8">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                <active.icon className="h-5 w-5" />
              </div>
              <div>
                <h3
                  className="text-xl font-semibold"
                  style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
                >
                  {active.title}
                </h3>
                <p className="mt-1 text-muted-foreground">{active.summary}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {active.points.map((point) => (
                <div
                  key={point}
                  className="flex items-start gap-3 rounded-lg bg-muted/30 p-3"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3 w-3" />
                  </div>
                  <p className="text-sm">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
