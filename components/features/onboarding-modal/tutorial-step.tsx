'use client'

/**
 * Story 25.2 (Epic 25, B.2): Onboarding modal — tutorial step shell.
 *
 * Mounts after Generera succeeds. Owns:
 *   1. <ProgressStrip> — SWR-shares the dashboard banner's poll cache.
 *   2. A six-tab bar (placeholder content in B.2 — B.3 fills `tutorial-tabs/`).
 *   3. A bottom-right Minimera affordance that hands off to the parent.
 *
 * Telemetry: `tab_viewed` fires on initial mount (default tab) AND on every
 * change to a different tab. Re-clicking the active tab is a no-op (debounce).
 *
 * No "← Tillbaka" affordance — generation is already in flight at this point
 * (AC 22).
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Minimize2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { recordTabViewed } from '@/app/actions/onboarding-modal'

import { ProgressStrip, type GenerationStatus } from './progress-strip'

export type TutorialTabId =
  | 'laglista'
  | 'kravpunkter'
  | 'uppgifter'
  | 'kontroller'
  | 'lagandringar'
  | 'ai-agent'

interface TabDef {
  id: TutorialTabId
  label: string
  hasNyChip?: boolean
}

const TABS: TabDef[] = [
  { id: 'laglista', label: 'Vad är en laglista?' },
  { id: 'kravpunkter', label: 'Kravpunkter & bevis' },
  { id: 'uppgifter', label: 'Uppgifter' },
  { id: 'kontroller', label: 'Kontroller' },
  { id: 'lagandringar', label: 'Lagändringar' },
  { id: 'ai-agent', label: 'AI-agenten', hasNyChip: true },
]

interface TutorialStepProps {
  initialStatus?: GenerationStatus | null | undefined
  onMinimise: () => void | Promise<void>
}

const DEFAULT_TAB_ID: TutorialTabId = 'laglista'

export function TutorialStep({ initialStatus, onMinimise }: TutorialStepProps) {
  const [activeTab, setActiveTab] = useState<TutorialTabId>(DEFAULT_TAB_ID)
  const tabRefs = useRef<Record<TutorialTabId, HTMLButtonElement | null>>({
    laglista: null,
    kravpunkter: null,
    uppgifter: null,
    kontroller: null,
    lagandringar: null,
    'ai-agent': null,
  })

  // Mount fire: record the initial tab view once. The ref guard matches the
  // pattern used by FirstRunModal's `openEventFired` for StrictMode safety.
  const initialFiredRef = useRef(false)
  useEffect(() => {
    if (initialFiredRef.current) return
    initialFiredRef.current = true
    void recordTabViewed(activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectTab(id: TutorialTabId) {
    if (id === activeTab) return
    setActiveTab(id)
    void recordTabViewed(id)
  }

  // QA-A11Y-001: roving tabindex requires arrow-key handling so keyboard users
  // can reach inactive tabs. Without arrow keys + tabIndex={-1} on inactive
  // tabs, only the active tab is Tab-reachable — violating AC 26. Implements
  // the standard ARIA tabs "automatic activation" pattern.
  function handleTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab)
    let nextIndex: number | null = null
    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % TABS.length
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length
    } else if (e.key === 'Home') {
      nextIndex = 0
    } else if (e.key === 'End') {
      nextIndex = TABS.length - 1
    }
    if (nextIndex === null) return
    e.preventDefault()
    const nextTab = TABS[nextIndex]
    if (!nextTab) return
    selectTab(nextTab.id)
    // Move focus to the newly-selected tab on next paint (after re-render
    // applies tabIndex={0} to it).
    requestAnimationFrame(() => {
      tabRefs.current[nextTab.id]?.focus()
    })
  }

  const activeIndex = TABS.findIndex((t) => t.id === activeTab)

  return (
    <div className="flex flex-col gap-5">
      <ProgressStrip initialStatus={initialStatus} />

      {/* Tab bar — horizontal scroll on narrow viewports. Underline on active
          tab matches the prototype at _prototypes/onboarding-tutorial-modal.html:877-884. */}
      <div
        role="tablist"
        aria-label="Onboarding-guide"
        className="-mx-1 flex items-center gap-0.5 overflow-x-auto border-b border-border px-1"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el
              }}
              type="button"
              role="tab"
              id={`tutorial-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls="tutorial-tabpanel"
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={handleTabKeyDown}
              data-onboarding-focus-target={
                tab.id === DEFAULT_TAB_ID ? 'true' : undefined
              }
              className={cn(
                'relative inline-flex shrink-0 items-center gap-1.5 px-3 py-3 text-[13.5px] outline-none transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm',
                isActive
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{tab.label}</span>
              {tab.hasNyChip && (
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: 'var(--tone-info-soft-bg)',
                    color: 'var(--tone-info-soft-fg)',
                  }}
                >
                  Ny
                </span>
              )}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-foreground"
                />
              )}
            </button>
          )
        })}
        <span className="ml-auto shrink-0 pl-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {activeIndex + 1} av {TABS.length}
        </span>
      </div>

      {/* Tab body — placeholder in B.2; B.3 fills with real per-tab content. */}
      <div
        id="tutorial-tabpanel"
        role="tabpanel"
        aria-labelledby={`tutorial-tab-${activeTab}`}
        className="min-h-[280px] px-1 pt-2 pb-2"
      >
        <p className="text-sm text-muted-foreground">Innehåll kommer snart</p>
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void onMinimise()
          }}
        >
          <Minimize2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Minimera
        </Button>
      </div>
    </div>
  )
}
