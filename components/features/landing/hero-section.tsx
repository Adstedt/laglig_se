import Link from 'next/link'
import {
  ArrowRight,
  Check,
  Play,
  Bell,
  FileText,
  CheckSquare,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="container relative mx-auto px-4 pb-16 pt-24 md:pb-24 md:pt-32 lg:pb-32 lg:pt-40">
        {/* Two-column layout for desktop */}
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16">
          {/* Left column - Text content */}
          <div className="max-w-2xl">
            {/* Eyebrow - Premium badge */}
            <div className="animate-fade-up mb-8">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50/50 px-4 py-2 text-sm shadow-sm backdrop-blur-sm dark:border-amber-800/40 dark:from-amber-950/30 dark:to-orange-950/20">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-medium text-amber-900 dark:text-amber-100">
                  För företag som tar compliance på allvar
                </span>
              </div>
            </div>

            {/* Headline - Large, asymmetric, editorial style */}
            <h1
              className="font-safiro animate-fade-up-delay-1 mb-8 text-[2.75rem] font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
              style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
            >
              <span className="block">Ha koll på lagarna.</span>
              <span className="block pl-0 sm:pl-8 md:pl-12">Utan krångel.</span>
            </h1>

            {/* Subheadline */}
            <div className="animate-fade-up-delay-2 mb-10 max-w-lg">
              <p className="text-lg text-muted-foreground md:text-xl">
                Full koll på ert företags lagkrav på 2 minuter. Sedan sköter vi
                resten.
              </p>
            </div>

            {/* CTAs - Premium buttons */}
            <div className="animate-fade-up-delay-3 mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button
                size="lg"
                className="group h-14 px-8 text-base shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
                asChild
              >
                <Link href="/onboarding">
                  Kom igång gratis
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="group h-14 px-8 text-base text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href="#how-it-works">
                  <Play className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                  Se hur det fungerar
                </Link>
              </Button>
            </div>

            {/* Trust signals - Premium inline badges */}
            <div className="animate-fade-up-delay-3 flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Ingen bindning</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Inget kort krävs</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>GDPR-säkrad</span>
              </div>
            </div>
          </div>

          {/* Right column - Product preview */}
          <div className="animate-fade-up-delay-2 relative">
            {/* Layered glow effect */}
            <div className="absolute -inset-8 rounded-3xl bg-gradient-to-br from-amber-200/40 via-orange-100/20 to-rose-100/30 blur-3xl" />
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-amber-100/60 to-transparent blur-2xl" />

            {/* Main card - Premium shadow stack */}
            <div className="relative rounded-2xl border border-border/50 bg-card shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_10px_15px_-3px_rgba(0,0,0,0.08),0_20px_25px_-5px_rgba(0,0,0,0.05)] transition-all duration-500 hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_15px_-3px_rgba(0,0,0,0.1),0_25px_50px_-12px_rgba(0,0,0,0.15)] hover:-translate-y-1">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="mx-auto max-w-sm rounded-md bg-muted px-4 py-1 text-xs text-muted-foreground">
                    app.laglig.se/dashboard
                  </div>
                </div>
              </div>

              {/* Dashboard preview - Stacked cards */}
              <div className="p-5">
                {/* Dashboard header */}
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Din laglista</h3>
                    <p className="text-sm text-muted-foreground">
                      23 lagar gäller ditt företag
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Bell className="h-3 w-3" />1 ny ändring
                  </Badge>
                </div>

                {/* Stacked cards - Core value flow */}
                <div className="space-y-3">
                  {/* Card 1 - Law List */}
                  <div className="rounded-xl border bg-card p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="rounded-lg bg-primary/10 p-1.5">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">Laglista</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                        <span>Arbetsmiljölagen</span>
                        <Check className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                        <span>GDPR</span>
                        <Check className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                        <span>Bokföringslagen</span>
                        <Check className="h-4 w-4 text-amber-600" />
                      </div>
                    </div>
                  </div>

                  {/* Card 2 - Change notification */}
                  <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 dark:from-amber-950/20 dark:to-orange-950/10">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-amber-500/10 p-1.5">
                          <Bell className="h-4 w-4 text-amber-600" />
                        </div>
                        <span className="text-sm font-medium">
                          Notis vid ändring
                        </span>
                      </div>
                      <span className="text-xs font-medium text-amber-600">
                        Ny
                      </span>
                    </div>
                    <p className="text-sm">
                      AFS 2024:1 träder i kraft 1 mars 2025
                    </p>
                  </div>

                  {/* Card 3 - Task created */}
                  <div className="rounded-xl border bg-gradient-to-br from-stone-50 to-stone-100/50 p-4 dark:from-stone-950/20 dark:to-stone-900/10">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-stone-500/10 p-1.5">
                          <CheckSquare className="h-4 w-4 text-stone-600" />
                        </div>
                        <span className="text-sm font-medium">
                          Uppgift skapas
                        </span>
                      </div>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-900/30 dark:text-stone-400">
                        Auto
                      </span>
                    </div>
                    <p className="text-sm">
                      Uppdatera säkerhetsrutin • Deadline 1 mars
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
