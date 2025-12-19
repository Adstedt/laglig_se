'use client'

import { MessageSquare, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface RightSidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function RightSidebar({ isOpen, onToggle }: RightSidebarProps) {
  return (
    <>
      {/* Toggle button when sidebar is folded - hidden on mobile */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="hidden lg:flex fixed right-0 top-1/2 z-40 h-14 w-8 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 bg-primary text-primary-foreground shadow-lg transition-all hover:w-10 hover:bg-primary/90"
          aria-label="Öppna AI Chat"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}

      {/* Sidebar container - hidden on mobile */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-l bg-card transition-all duration-200 ease-in-out',
          isOpen ? 'w-[400px]' : 'w-0 overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="flex h-[60px] items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI Assistent</h2>
              <p className="text-xs text-muted-foreground">Fråga om lagar</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Stäng AI Chat</span>
          </Button>
        </div>

        {/* Placeholder content */}
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-6 text-lg font-semibold">AI Chat kommer snart</h3>
          <p className="mt-2 max-w-[280px] text-sm text-muted-foreground">
            Ställ frågor om lagar och regler direkt i chatten. AI:n hjälper dig
            hitta relevant information.
          </p>
        </div>

        {/* Drop zone placeholder */}
        <div className="border-t bg-muted/30 p-4">
          <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-background/50 transition-colors hover:border-muted-foreground/40">
            <p className="text-sm text-muted-foreground">
              Dra och släpp dokument här
            </p>
          </div>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="border-t px-4 py-3">
          <p className="text-center text-xs text-muted-foreground">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>{' '}
            eller{' '}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              /
            </kbd>{' '}
            för att växla
          </p>
        </div>
      </aside>
    </>
  )
}
