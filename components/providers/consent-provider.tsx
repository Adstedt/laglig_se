'use client'

/**
 * Hydrates the consent record from localStorage on mount and exposes
 * `accept`, `reject`, `update`, and `openSettings` to descendants.
 *
 * The banner reads `hasDecided` to decide whether to render itself; the
 * footer link calls `openSettings()` to re-open the dialog post-decision.
 * Every state-change writes to localStorage *and* calls
 * `gtag('consent', 'update', ...)` so any analytics already loaded swaps
 * collection on/off immediately.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ACCEPT_ALL_CATEGORIES,
  CONSENT_VERSION,
  DEFAULT_CATEGORIES,
  type ConsentCategories,
  type ConsentRecord,
} from '@/lib/consent/types'
import { readConsent, writeConsent } from '@/lib/consent/storage'
import { applyConsent } from '@/lib/consent/gtag'

interface ConsentContextValue {
  /** True once we've checked localStorage and know the user's prior choice. */
  hydrated: boolean
  /** True if the user has previously accepted or rejected. */
  hasDecided: boolean
  /** Current per-category state (default-denied until hydrated + decided). */
  categories: ConsentCategories
  acceptAll: () => void
  rejectAll: () => void
  update: (_partial: Partial<ConsentCategories>) => void
  /** Open the settings dialog (e.g. from the footer "Cookieinställningar" link). */
  openSettings: () => void
  /** Internal: settings-dialog visibility (consumed by the dialog component). */
  settingsOpen: boolean
  setSettingsOpen: (_open: boolean) => void
}

const NOOP = () => {}

const ConsentContext = createContext<ConsentContextValue>({
  hydrated: false,
  hasDecided: false,
  categories: DEFAULT_CATEGORIES,
  acceptAll: NOOP,
  rejectAll: NOOP,
  update: NOOP,
  openSettings: NOOP,
  settingsOpen: false,
  setSettingsOpen: NOOP,
})

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const [record, setRecord] = useState<ConsentRecord | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Hydrate from localStorage. Runs once on mount.
  useEffect(() => {
    const stored = readConsent()
    if (stored) {
      setRecord(stored)
      // Apply on hydrate too so the gtag default→granted transition fires
      // even when the page is reloaded after a previous accept.
      applyConsent(stored.categories)
    }
    setHydrated(true)
  }, [])

  const persist = useCallback((categories: ConsentCategories) => {
    const next: ConsentRecord = {
      version: CONSENT_VERSION,
      acceptedAt: new Date().toISOString(),
      categories,
    }
    writeConsent(next)
    setRecord(next)
    applyConsent(categories)
  }, [])

  const acceptAll = useCallback(() => {
    persist(ACCEPT_ALL_CATEGORIES)
    setSettingsOpen(false)
  }, [persist])

  const rejectAll = useCallback(() => {
    persist(DEFAULT_CATEGORIES)
    setSettingsOpen(false)
  }, [persist])

  const update = useCallback(
    (partial: Partial<ConsentCategories>) => {
      const current = record?.categories ?? DEFAULT_CATEGORIES
      persist({ ...current, ...partial })
    },
    [persist, record?.categories]
  )

  const openSettings = useCallback(() => setSettingsOpen(true), [])

  const value = useMemo<ConsentContextValue>(
    () => ({
      hydrated,
      hasDecided: record !== null,
      categories: record?.categories ?? DEFAULT_CATEGORIES,
      acceptAll,
      rejectAll,
      update,
      openSettings,
      settingsOpen,
      setSettingsOpen,
    }),
    [hydrated, record, acceptAll, rejectAll, update, openSettings, settingsOpen]
  )

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  )
}

export function useConsent(): ConsentContextValue {
  return useContext(ConsentContext)
}
