'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Check,
  Bell,
  Clock,
  Users,
  ChevronRight,
  Calendar,
  ClipboardCheck,
  History,
  Paperclip,
  FileCheck,
  Eye,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ---------- Feature data ----------
// Note: "uppgifter" copy is softened to honestly reflect the AI-chat-driven flow
// (no standalone task-proposal queue exists yet).
const features = [
  {
    id: 'laglista',
    title: 'Personlig laglista',
    description:
      'Sluta gissa vilka lagar som gäller er. Ange org-nummer och få en komplett lista på sekunder.',
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    expandedTitle: 'Vet exakt vilka lagar som gäller er',
    expandedDescription:
      'Ingen mer osäkerhet. Vi analyserar er bransch, storlek och verksamhet för att ge er en komplett bild av ert juridiska landskap.',
  },
  {
    id: 'notiser',
    title: 'Proaktiva notiser',
    description:
      'Aldrig mer panik. Få besked i god tid innan nya krav träder i kraft.',
    icon: <Bell className="h-6 w-6" strokeWidth={1.5} />,
    expandedTitle: 'Sov gott – vi bevakar åt er',
    expandedDescription:
      'Vi håller koll på alla lagändringar som påverkar er, dygnet runt. Ni får besked i god tid, så ni alltid ligger steget före.',
  },
  {
    id: 'uppgifter',
    title: 'Uppgifter från AI',
    description:
      'Ställ frågan om en lagändring i chatten – AI:n föreslår uppgifter med deadlines. Du godkänner.',
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    ),
    expandedTitle: 'Från lagändring till uppgift – via AI-chatten',
    expandedDescription:
      'Be AI:n analysera en ny AFS eller lagändring. Den föreslår konkreta uppgifter med deadlines och förslag på ansvariga. Du granskar och lägger till i Kanban med ett klick.',
  },
  {
    id: 'ai',
    title: 'AI-assistent',
    description:
      'Fråga vad som helst om lagen – på vanlig svenska. Svar på sekunder, alltid med källhänvisning.',
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
        />
      </svg>
    ),
    badge: 'RAG',
    expandedTitle: 'Din juridiska expertis – tillgänglig dygnet runt',
    expandedDescription:
      'Sluta googla och hoppas på det bästa. Vår AI ger er pålitliga svar med exakta källhänvisningar, när ni behöver dem.',
  },
  {
    id: 'team',
    title: 'Team-samarbete',
    description:
      'Jobba tillsammans. Kommentera, dela dokument och följ varandras progress.',
    icon: <Users className="h-6 w-6" strokeWidth={1.5} />,
    badge: 'Team',
    expandedTitle: 'Hela teamet på samma sida',
    expandedDescription:
      'Tilldela uppgifter, kommentera, ladda upp bevis och följ progress i realtid. Alla vet vad som behöver göras.',
  },
  {
    id: 'kanban',
    title: 'Kanban-arbetsyta',
    description:
      'Full överblick. Se alla uppgifter och deras status i en vy. Lista, kalender och kanban.',
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z"
        />
      </svg>
    ),
    expandedTitle: 'Ha alltid full koll på läget',
    expandedDescription:
      'Alla uppgifter, all progress, en vy. Dra och släpp för att uppdatera status. Enkelt att följa upp och prioritera.',
  },
  // ---------- NEW compliance-management cards ----------
  {
    id: 'krav',
    title: 'Krav & bevis',
    description:
      'Bryt ned varje lag till konkreta kravpunkter och koppla bevisen direkt – filer, intyg, rutiner.',
    icon: <FileCheck className="h-6 w-6" strokeWidth={1.5} />,
    badge: 'Nytt',
    expandedTitle: 'Från lag till uppfyllt krav – med bevis i botten',
    expandedDescription:
      'För varje lag listas kravpunkterna ni behöver uppfylla. Koppla intyg, rutiner och uppgifter som bevis – så ni alltid kan visa hur ni efterlever, kravpunkt för kravpunkt.',
  },
  {
    id: 'kontroller',
    title: 'Lagefterlevnadskontroller',
    description:
      'Schemalägg återkommande granskningar. Spåra avvikelser, åtgärdsplaner och revisor-bedömningar.',
    icon: <ClipboardCheck className="h-6 w-6" strokeWidth={1.5} />,
    badge: 'Nytt',
    expandedTitle: 'Audit-redo, året runt',
    expandedDescription:
      'Lägg upp kontrollcykler per lag eller område. AUDITOR-rollen ger revisorer läs-access utan att kompromissa med behörigheter. ISO 19011-vänliga findings, åtgärdsplaner och spårbarhet på ett ställe.',
  },
  {
    id: 'dokument',
    title: 'Versionerade dokument',
    description:
      'Policies, rutiner och styrdokument med full versionshistorik. Alltid spårbart vem som ändrat vad.',
    icon: <History className="h-6 w-6" strokeWidth={1.5} />,
    badge: 'Nytt',
    expandedTitle: 'Styrdokument utan e-postkedjor',
    expandedDescription:
      'Lagra policies och rutiner med versionshistorik. Koppla dem till relevanta lagar och kravpunkter. Ändringar är spårbara – revisorn ser exakt vilken version som gällde vid en viss tidpunkt.',
  },
]

// ---------- Preview components ----------

function LaglistaPreview() {
  const laws = [
    {
      name: 'Arbetsmiljölagen (1977:1160)',
      category: 'Arbetsmiljö',
      checked: true,
    },
    { name: 'GDPR', category: 'Dataskydd', checked: true },
    { name: 'Bokföringslagen (1999:1078)', category: 'Ekonomi', checked: true },
    { name: 'Diskrimineringslagen', category: 'Arbetsrätt', checked: false },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">Din laglista</span>
          <Badge variant="secondary" className="text-xs">
            Konsultbolag
          </Badge>
        </div>
        {laws.map((law, i) => (
          <motion.div
            key={law.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-lg border bg-card p-3"
          >
            <div
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                law.checked
                  ? 'bg-emerald-500 text-white'
                  : 'border-2 border-muted-foreground/30'
              )}
            >
              {law.checked && <Check className="h-3 w-3" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{law.name}</p>
              <p className="text-xs text-muted-foreground">{law.category}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-6 text-center dark:from-emerald-950/30 dark:to-emerald-900/20">
        <div
          className="mb-2 text-4xl font-bold text-emerald-600"
          style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
        >
          54
        </div>
        <p className="text-sm text-muted-foreground">
          lagar gäller ditt företag
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Baserat på SNI-kod 70.220
        </p>
      </div>
    </div>
  )
}

function NotiserPreview() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:border-amber-800 dark:from-amber-950/50 dark:to-orange-950/30"
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white">
            <Bell className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            In-app notis
          </span>
        </div>
        <p className="text-sm font-semibold">Ny lagändring: AFS 2024:1</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Arbetsmiljöverkets föreskrifter om SAM uppdateras.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <Clock className="h-3 w-3" />
          <span>Träder i kraft om 87 dagar</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border bg-card p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">E-post skickad</span>
        </div>
        <p className="text-sm font-semibold">⚠️ Lagändring som påverkar dig</p>
        <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
          Hej! En lag i din laglista har uppdaterats. AFS 2024:1 träder i kraft
          den 1 mars 2025. Klicka här för att läsa mer och skapa uppgifter...
        </p>
      </motion.div>
    </div>
  )
}

function UppgifterPreview() {
  const [accepted, setAccepted] = React.useState(false)

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="md:col-span-3 rounded-xl border bg-card p-5"
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-xs font-bold text-white">
            AI
          </div>
          <span className="text-sm font-medium">
            Föreslagen av AI i chatten
          </span>
        </div>
        <p className="text-base font-semibold">
          Uppdatera rutin för systematiskt arbetsmiljöarbete
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Baserat på AFS 2024:1. AI:n föreslår: granska era SAM-rutiner och
          uppdatera dokumentationen enligt nya kraven.
        </p>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" /> Förslagen deadline: 1 mars 2025
          </span>
        </div>
        {!accepted ? (
          <div className="mt-4 flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.stopPropagation()
                setAccepted(true)
              }}
              className="flex-1 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background"
            >
              Lägg till i Kanban
            </motion.button>
            <button className="rounded-lg border px-4 py-2.5 text-sm text-muted-foreground">
              Redigera först
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-600"
          >
            <Check className="h-4 w-4" />
            Uppgift skapad och tillagd i Kanban
          </motion.div>
        )}
      </motion.div>

      <div className="md:col-span-2 flex flex-col items-center justify-center rounded-xl bg-muted/50 p-4 text-center">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-slate-400" />
          <div className="h-0.5 w-8 bg-muted-foreground/30" />
          <div className="h-3 w-3 rounded-full bg-violet-400" />
          <div className="h-0.5 w-8 bg-muted-foreground/30" />
          <div className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <p className="text-xs text-muted-foreground">
          Lagändring → Chatta med AI → Uppgift
        </p>
      </div>
    </div>
  )
}

function AIPreview() {
  const [taskAccepted, setTaskAccepted] = React.useState(false)

  return (
    <div className="w-full">
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-3 bg-muted/30">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
            AI
          </div>
          <span className="text-sm font-medium">Laglig AI</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </div>

        <div className="p-4 space-y-4 bg-muted/10 max-h-[400px] overflow-y-auto">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-foreground px-4 py-2.5 text-sm text-background">
              Vi fick just besked om en ny AFS. Vad innebär det för oss?
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
              AI
            </div>
            <div className="space-y-3 min-w-0 flex-1 max-w-[85%]">
              <div className="rounded-2xl rounded-tl-sm bg-background border px-4 py-3 text-sm">
                <p>
                  <span className="font-semibold text-violet-600 dark:text-violet-400">
                    AFS 2024:1
                  </span>{' '}
                  om systematiskt arbetsmiljöarbete träder i kraft 1 mars 2025.
                  För er innebär det:
                </p>
                <ul className="mt-2 ml-4 list-disc text-muted-foreground space-y-0.5">
                  <li>Utökade krav på riskbedömning vid distansarbete</li>
                  <li>Dokumentation av psykosocial arbetsmiljö</li>
                </ul>
                <p className="mt-3">Vill du att jag lägger upp en uppgift?</p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500 text-white">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      Uppdatera SAM-rutiner enligt AFS 2024:1
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Granska och uppdatera dokumentation för systematiskt
                      arbetsmiljöarbete.
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Förslag: 15 feb 2025
                      </span>
                    </div>
                  </div>
                </div>

                {!taskAccepted ? (
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setTaskAccepted(true)
                      }}
                      className="flex-1 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:bg-foreground/90 transition-colors"
                    >
                      Lägg till i Kanban
                    </button>
                    <button className="rounded-lg border px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors">
                      Redigera
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t text-emerald-600">
                    <Check className="h-4 w-4" />
                    <span className="text-xs font-medium">
                      Uppgift tillagd i Kanban
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  AFS 2024:1
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  AML 3 kap.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t px-4 py-3 bg-background">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
            <span className="text-sm text-muted-foreground">
              Ställ en fråga...
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TeamPreview() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card p-4"
      >
        <p className="text-sm font-medium mb-3">Teamöversikt</p>
        <div className="space-y-3">
          {[
            {
              name: 'Anna S.',
              initials: 'AS',
              color:
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
              tasks: 4,
              total: 5,
            },
            {
              name: 'Erik L.',
              initials: 'EL',
              color:
                'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
              tasks: 2,
              total: 3,
            },
            {
              name: 'Maria K.',
              initials: 'MK',
              color:
                'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
              tasks: 1,
              total: 4,
            },
          ].map((member) => (
            <div key={member.name} className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                  member.color
                )}
              >
                {member.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{member.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {member.tasks}/{member.total}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${(member.tasks / member.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Totalt klart</span>
            <span
              className="font-semibold"
              style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
            >
              7/12 uppgifter
            </span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border bg-card p-4"
      >
        <p className="text-sm font-medium mb-3">Roller & behörigheter</p>
        <div className="space-y-2">
          {[
            {
              role: 'OWNER',
              color: 'bg-foreground text-background',
              desc: 'Full kontroll, fakturering',
            },
            {
              role: 'ADMIN',
              color: 'bg-blue-500 text-white',
              desc: 'Hantera workspace och medlemmar',
            },
            {
              role: 'MEMBER',
              color: 'bg-emerald-500 text-white',
              desc: 'Skapa och hantera uppgifter',
            },
            {
              role: 'AUDITOR',
              color: 'bg-violet-500 text-white',
              desc: 'Läs-access för externa revisorer',
            },
          ].map((r) => (
            <div
              key={r.role}
              className="flex items-center gap-3 rounded-lg bg-muted/30 p-2"
            >
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-semibold',
                  r.color
                )}
              >
                {r.role}
              </span>
              <span className="text-xs text-muted-foreground">{r.desc}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function KanbanPreview() {
  const columns = [
    {
      title: 'Att göra',
      color: 'bg-slate-500',
      tasks: [
        { name: 'Uppdatera GDPR-policy', law: 'GDPR Art. 30' },
        { name: 'Granska brandskydd', law: 'AFS 2020:1' },
      ],
    },
    {
      title: 'Pågående',
      color: 'bg-blue-500',
      tasks: [{ name: 'Revidera SAM-rutin', law: 'AML 3 kap.' }],
    },
    {
      title: 'Klart',
      color: 'bg-emerald-500',
      tasks: [
        { name: 'Årsredovisning', law: 'ÅRL 2 kap.' },
        { name: 'Arbetsmiljöenkät', law: 'AFS 2001:1' },
      ],
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {columns.map((col, i) => (
        <motion.div
          key={col.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="rounded-xl border bg-muted/30 p-3"
        >
          <div className="mb-3 flex items-center gap-2">
            <div className={cn('h-2.5 w-2.5 rounded-full', col.color)} />
            <span className="text-sm font-medium">{col.title}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {col.tasks.length}
            </span>
          </div>
          <div className="space-y-2">
            {col.tasks.map((task) => (
              <div
                key={task.name}
                className="rounded-lg border bg-card p-2.5 text-xs"
              >
                <div className="font-medium">{task.name}</div>
                <div className="mt-1 text-muted-foreground">{task.law}</div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ---------- NEW previews ----------

function KravPreview() {
  const kravpunkter = [
    {
      title: 'Riskbedömning genomförd årligen',
      ref: 'AFS 2001:1 §8',
      evidence: 'riskbedomning_2025.pdf',
      done: true,
    },
    {
      title: 'Skyddsombud utsedd och kontaktbar',
      ref: 'AML 6 kap.',
      evidence: 'protokoll_skyddsombud.pdf',
      done: true,
    },
    {
      title: 'Introduktionsutbildning för nyanställda',
      ref: 'AFS 2001:1 §7',
      evidence: 'kursintyg_q1.pdf',
      done: true,
    },
    {
      title: 'Dokumentation av psykosocial arbetsmiljö',
      ref: 'AFS 2015:4',
      evidence: null,
      done: false,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <div className="md:col-span-3 rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">
              Arbetsmiljölagen (1977:1160)
            </p>
            <p className="text-xs text-muted-foreground">4 kravpunkter</p>
          </div>
          <Badge variant="secondary" className="text-xs">
            3/4 uppfyllda
          </Badge>
        </div>
        <div className="space-y-2">
          {kravpunkter.map((k, i) => (
            <motion.div
              key={k.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'rounded-lg border p-3',
                k.done
                  ? 'border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-800/40 dark:bg-emerald-950/20'
                  : 'border-amber-200/60 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/20'
              )}
            >
              <div className="flex items-start gap-2">
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                    k.done
                      ? 'bg-emerald-500 text-white'
                      : 'border-2 border-amber-500'
                  )}
                >
                  {k.done && <Check className="h-2.5 w-2.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{k.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {k.ref}
                  </p>
                  {k.evidence ? (
                    <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      <Paperclip className="h-2.5 w-2.5" />
                      {k.evidence}
                    </div>
                  ) : (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                      Bevis saknas
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="md:col-span-2 flex flex-col justify-center rounded-xl bg-muted/50 p-5">
        <p className="text-xs font-medium text-muted-foreground">
          Spårbarhet per kravpunkt
        </p>
        <p
          className="mt-2 text-3xl font-bold text-emerald-600"
          style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
        >
          75%
        </p>
        <p className="text-xs text-muted-foreground">uppfyllelse</p>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-3/4 rounded-full bg-emerald-500" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Varje krav är kopplat till bevis – revisorn kan klicka sig hela vägen
          ner till källan.
        </p>
      </div>
    </div>
  )
}

function KontrollerPreview() {
  const cycles = [
    {
      name: 'Arbetsmiljö – Q1 2026',
      due: '31 mars',
      status: 'Pågår',
      color: 'bg-blue-500',
      progress: 60,
    },
    {
      name: 'Dataskydd (GDPR) – årlig',
      due: '15 maj',
      status: 'Schemalagd',
      color: 'bg-slate-400',
      progress: 0,
    },
    {
      name: 'Brandskydd – halvår',
      due: '14 feb',
      status: 'Klar',
      color: 'bg-emerald-500',
      progress: 100,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <div className="md:col-span-3 space-y-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium">Kontrollcykler</span>
          <span className="text-xs text-muted-foreground">
            <Calendar className="mr-1 inline h-3 w-3" />
            2026
          </span>
        </div>
        {cycles.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg border bg-card p-3"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">Senast: {c.due}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <span className={cn('h-1.5 w-1.5 rounded-full', c.color)} />
                {c.status}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', c.color)}
                style={{ width: `${c.progress}%` }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="md:col-span-2 flex flex-col rounded-xl bg-violet-50/60 p-5 dark:bg-violet-950/20">
        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-white">
          <Eye className="h-4 w-4" />
        </div>
        <p className="text-sm font-semibold">AUDITOR-vy</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Bjud in revisorn med läs-access. De ser findings, åtgärdsplaner och
          alla bevis – utan att kunna ändra.
        </p>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <Check className="h-3 w-3 text-emerald-500" />
            <span className="text-muted-foreground">ISO 19011-vänligt</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Check className="h-3 w-3 text-emerald-500" />
            <span className="text-muted-foreground">Findings & root cause</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Check className="h-3 w-3 text-emerald-500" />
            <span className="text-muted-foreground">Komplett audit trail</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function DokumentPreview() {
  const versions = [
    {
      v: 'v3.1',
      label: 'Aktuell',
      author: 'Anna S.',
      when: '12 mar 2026',
      current: true,
    },
    {
      v: 'v3.0',
      label: 'Tidigare',
      author: 'Erik L.',
      when: '5 nov 2025',
      current: false,
    },
    {
      v: 'v2.4',
      label: 'Tidigare',
      author: 'Anna S.',
      when: '20 aug 2025',
      current: false,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <div className="md:col-span-3 rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">SAM-rutin 2026</p>
            <p className="text-xs text-muted-foreground">
              Kopplad till: AFS 2001:1, AML 3 kap.
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            Aktiv
          </Badge>
        </div>

        <p className="text-xs font-medium text-muted-foreground mb-2">
          Versionshistorik
        </p>
        <div className="space-y-2">
          {versions.map((v, i) => (
            <motion.div
              key={v.v}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-2.5',
                v.current
                  ? 'border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-800/40 dark:bg-emerald-950/20'
                  : 'bg-muted/30'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded text-[11px] font-mono font-semibold',
                  v.current
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {v.v}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{v.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {v.author} · {v.when}
                </p>
              </div>
              {v.current && (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  AKTUELL
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="md:col-span-2 flex flex-col justify-center rounded-xl bg-muted/50 p-5">
        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
          <History className="h-4 w-4" />
        </div>
        <p className="text-sm font-semibold">Spårbarhet bakåt i tiden</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Revisorn kan se exakt vilken policy som gällde 14 augusti 2025 – och
          jämföra med dagens version.
        </p>
      </div>
    </div>
  )
}

const previewComponents: Record<string, React.ReactNode> = {
  laglista: <LaglistaPreview />,
  notiser: <NotiserPreview />,
  uppgifter: <UppgifterPreview />,
  ai: <AIPreview />,
  team: <TeamPreview />,
  kanban: <KanbanPreview />,
  krav: <KravPreview />,
  kontroller: <KontrollerPreview />,
  dokument: <DokumentPreview />,
}

function FeatureCard({
  feature,
  isSelected,
  onClick,
  isHero = false,
}: {
  feature: (typeof features)[0]
  isSelected: boolean
  onClick: () => void
  isHero?: boolean
}) {
  const isNew = feature.badge === 'Nytt'
  return (
    <motion.div
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer rounded-2xl border bg-card p-6 h-full flex flex-col overflow-hidden',
        'transition-all duration-300 ease-out',
        isHero &&
          'bg-gradient-to-br from-violet-50/70 via-purple-50/40 to-fuchsia-50/50 dark:from-violet-950/30 dark:via-purple-950/20 dark:to-fuchsia-950/20',
        isHero &&
          !isSelected &&
          'border-violet-200/60 dark:border-violet-800/50',
        isNew &&
          !isSelected &&
          'border-emerald-200/60 dark:border-emerald-800/50',
        isSelected
          ? 'border-primary/50 ring-2 ring-primary/20 shadow-xl shadow-primary/10'
          : isHero
            ? 'hover:border-violet-300 hover:shadow-xl hover:shadow-violet-500/15'
            : 'hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5'
      )}
      whileHover={{ y: -4, transition: { duration: 0.3, ease: 'easeOut' } }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-300',
          isHero
            ? 'bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100'
            : 'bg-gradient-to-br from-primary/3 via-transparent to-primary/3 opacity-0 group-hover:opacity-100'
        )}
      />

      <div className="relative">
        <div
          className={cn(
            'mb-5 flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300',
            isHero
              ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25'
              : isNew
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : isSelected
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary group-hover:shadow-md group-hover:shadow-primary/10'
          )}
        >
          {feature.icon}
        </div>

        <h3
          className="mb-2.5 text-lg font-semibold"
          style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
        >
          {feature.title}
          {feature.badge && (
            <Badge
              variant="secondary"
              className={cn(
                'ml-2 text-xs',
                isHero &&
                  'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
                isNew &&
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
              )}
            >
              {feature.badge}
            </Badge>
          )}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground flex-grow">
          {feature.description}
        </p>

        <div
          className={cn(
            'mt-4 flex items-center gap-1.5 text-xs font-medium transition-all duration-200',
            isSelected
              ? 'text-primary opacity-100'
              : 'text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5'
          )}
        >
          <span>{isSelected ? 'Klicka för att stänga' : 'Se exempel'}</span>
          <ChevronRight
            className={cn(
              'h-3 w-3 transition-transform duration-200',
              isSelected && 'rotate-90'
            )}
          />
        </div>
      </div>
    </motion.div>
  )
}

function ExpandedPreview({
  feature,
  onClose,
}: {
  feature: (typeof features)[0]
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="col-span-full overflow-hidden"
    >
      <div className="rounded-2xl border bg-gradient-to-b from-muted/50 to-muted/20 p-6 md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {feature.icon}
            </div>
            <div>
              <h3
                className="text-xl font-semibold"
                style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
              >
                {feature.expandedTitle}
                {feature.badge && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {feature.badge}
                  </Badge>
                )}
              </h3>
              <p className="mt-1 text-muted-foreground">
                {feature.expandedDescription}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {previewComponents[feature.id]}
        </motion.div>
      </div>
    </motion.div>
  )
}

export function FeaturesSectionV2() {
  const [selectedId, setSelectedId] = React.useState<string | null>('laglista')
  const selectedFeature = features.find((f) => f.id === selectedId)

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  // ---------- New 3-row layout ----------
  // Row 1: Setup flow (Laglista → Notiser → Uppgifter)
  // Row 2: AI hero + Team + Kanban
  // Row 3 (NEW): Krav + Kontroller + Dokument — compliance management capabilities
  const rowOne = features.filter((f) =>
    ['laglista', 'notiser', 'uppgifter'].includes(f.id)
  )
  const aiFeature = features.find((f) => f.id === 'ai')!
  const rowTwoSupport = features.filter((f) =>
    ['team', 'kanban'].includes(f.id)
  )
  const rowThree = features.filter((f) =>
    ['krav', 'kontroller', 'dokument'].includes(f.id)
  )

  return (
    <section className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-16">
          <h2
            className="font-safiro mb-4 text-3xl font-medium tracking-tight sm:text-4xl"
            style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
          >
            Vi håller koll. Ni fokuserar på affären.
          </h2>
          <p className="text-lg text-muted-foreground">
            Från personlig laglista till audit-redo compliance – i en
            sammanhängande arbetsyta.
          </p>
        </div>

        <div className="mx-auto max-w-5xl space-y-4">
          {/* Row 1: Core flow */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {rowOne.map((feature, index) => (
              <div key={feature.id} className="relative">
                {index < rowOne.length - 1 && (
                  <div className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 md:block">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                )}
                <FeatureCard
                  feature={feature}
                  isSelected={selectedId === feature.id}
                  onClick={() =>
                    setSelectedId(selectedId === feature.id ? null : feature.id)
                  }
                />
              </div>
            ))}
          </div>

          <AnimatePresence>
            {selectedFeature &&
              ['laglista', 'notiser', 'uppgifter'].includes(
                selectedFeature.id
              ) && (
                <ExpandedPreview
                  feature={selectedFeature}
                  onClose={() => setSelectedId(null)}
                />
              )}
          </AnimatePresence>

          {/* Row 2: AI hero + Team + Kanban */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FeatureCard
              feature={aiFeature}
              isSelected={selectedId === 'ai'}
              onClick={() => setSelectedId(selectedId === 'ai' ? null : 'ai')}
              isHero
            />
            {rowTwoSupport.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                isSelected={selectedId === feature.id}
                onClick={() =>
                  setSelectedId(selectedId === feature.id ? null : feature.id)
                }
              />
            ))}
          </div>

          <AnimatePresence>
            {selectedFeature &&
              ['ai', 'team', 'kanban'].includes(selectedFeature.id) && (
                <ExpandedPreview
                  feature={selectedFeature}
                  onClose={() => setSelectedId(null)}
                />
              )}
          </AnimatePresence>

          {/* Row 3: NEW — Compliance management capabilities */}
          <div className="pt-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Compliance management
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {rowThree.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                isSelected={selectedId === feature.id}
                onClick={() =>
                  setSelectedId(selectedId === feature.id ? null : feature.id)
                }
              />
            ))}
          </div>

          <AnimatePresence>
            {selectedFeature &&
              ['krav', 'kontroller', 'dokument'].includes(
                selectedFeature.id
              ) && (
                <ExpandedPreview
                  feature={selectedFeature}
                  onClose={() => setSelectedId(null)}
                />
              )}
          </AnimatePresence>

          <div className="pt-12 text-center">
            <p className="mb-6 text-lg text-muted-foreground">
              Se hur det fungerar för ert företag
            </p>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-full bg-foreground px-8 py-3.5 text-base font-medium text-background transition-all hover:bg-foreground/90 hover:scale-105 shadow-lg"
            >
              Så kommer ni igång
              <ChevronRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
