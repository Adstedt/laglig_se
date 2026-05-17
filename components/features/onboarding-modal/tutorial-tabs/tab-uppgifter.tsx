/**
 * Story 25.3 (Epic 25, B.3): Tutorial tab — "Uppgifter"
 *
 * Ports prototype PANEL 3 (_prototypes/onboarding-tutorial-modal.html:1512-1847).
 * Mini 3-column Kanban with one task per column + an AI-spawned task chip.
 */

import {
  ArrowUpRight,
  ListTodo,
  Sparkles,
  UserRound,
  Link2,
} from 'lucide-react'

export function TabUppgifter() {
  return (
    <div className="grid grid-cols-5 gap-8 px-1 pt-2 pb-2">
      {/* LEFT: copy */}
      <div className="col-span-2">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Handling
        </div>
        <h3 className="font-safiro mb-3 text-[22px] leading-snug tracking-tight">
          Från krav till uppgift — utan extra verktyg
        </h3>
        <p className="mb-5 text-[13.5px] leading-relaxed text-muted-foreground">
          Behöver ni uppdatera en rutin, samla in bevis eller boka en revision?
          Skapa en uppgift direkt från ett krav. AI-agenten kan också föreslå
          eller skapa uppgifter åt er när en lag ändras.
        </p>
        <ul className="mb-6 space-y-3">
          {[
            {
              Icon: ListTodo,
              title: 'Kanban som ni känner igen',
              body: 'Att göra → Pågår → Klart. Drag-och-släpp, deadlines, ansvariga.',
            },
            {
              Icon: Link2,
              title: 'Kopplade till lagkrav',
              body: 'Varje uppgift länkar till en kravpunkt — så ni alltid vet varför den finns.',
            },
            {
              Icon: Sparkles,
              title: 'AI-skapade uppgifter',
              body: 'När en paragraf ändras: agenten föreslår uppgifter med rätt deadline + rätt person.',
            },
          ].map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3 text-[13px]">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-section-sage">
                <Icon
                  className="h-3 w-3 text-[hsl(var(--tone-success-soft-fg))]"
                  aria-hidden="true"
                />
              </span>
              <span>
                <span className="font-medium">{title}</span>
                <span className="block text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-sm text-[12.5px] font-medium text-foreground underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Läs mer i hjälpcentret
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* RIGHT: kanban mock */}
      <div className="col-span-3">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Förhandsvisning · /uppgifter
        </div>
        <div className="grid grid-cols-3 gap-2">
          <KanbanColumn
            color="bg-muted-foreground/40"
            title="Att göra"
            count={5}
            cards={[
              {
                title: 'Uppdatera kemikalielistan',
                meta: 'Erik H · 12 mars',
                lawBadge: 'Kemiprodukt-förordn.',
              },
            ]}
          />
          <KanbanColumn
            color="bg-[hsl(var(--tone-info-soft-fg))]"
            title="Pågår"
            count={2}
            cards={[
              {
                title: 'Samla in bevis för Egenkontroll',
                meta: 'Maria L · 18 mars',
                lawBadge: 'Miljöbalk',
                aiSpawned: true,
              },
            ]}
          />
          <KanbanColumn
            color="bg-[hsl(var(--tone-success-soft-fg))]"
            title="Klart"
            count={11}
            cards={[
              {
                title: 'Genomför riskbedömning Q1',
                meta: 'Alexander A · 2 mars',
                lawBadge: 'AFS 2020:1',
                done: true,
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

function KanbanColumn({
  color,
  title,
  count,
  cards,
}: {
  color: string
  title: string
  count: number
  cards: Array<{
    title: string
    meta: string
    lawBadge: string
    aiSpawned?: boolean
    done?: boolean
  }>
}) {
  return (
    <div className="rounded-lg bg-muted/30 p-2">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${color}`}
        />
        <span className="text-[11.5px] font-medium">{title}</span>
        <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[9.5px] text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="space-y-1.5">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`rounded-md border border-border bg-background p-2 ${
              card.done ? 'opacity-70' : ''
            }`}
          >
            {card.aiSpawned && (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--tone-info-soft-bg))] px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider text-[hsl(var(--tone-info-soft-fg))]">
                <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                AI-skapad
              </span>
            )}
            <div
              className={`text-[11.5px] font-medium leading-snug ${
                card.done ? 'line-through' : ''
              }`}
            >
              {card.title}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <UserRound className="h-2.5 w-2.5" aria-hidden="true" />
              {card.meta}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[9.5px] text-muted-foreground">
              <Link2 className="h-2.5 w-2.5" aria-hidden="true" />
              {card.lawBadge}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
