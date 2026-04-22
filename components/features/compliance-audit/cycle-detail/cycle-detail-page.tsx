'use client'

/**
 * Story 21.5 — Orchestrator client component for /laglistor/kontroller/[cycleId].
 * Owns SWR data + mutation callbacks + the progress-cluster context so the
 * header and the items table share a single source of truth.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CycleDetailHeader } from './cycle-detail-header'
import { CycleItemsTab } from './cycle-items-tab'
import {
  CycleItemsProvider,
  type CycleItemsContextValue,
} from './cycle-items-context'
import {
  getCycleItemsForCycle,
  updateItemBedomning,
  updateItemMotivering,
  signOffItem,
  unsignOffItem,
  type CycleItemRow,
  type CyclePartial,
  type GetCycleItemsResult,
} from '@/app/actions/compliance-audit-item'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'
import type { EfterlevnadsBedomning } from '@prisma/client'

const TABS = ['items', 'findings', 'rapport', 'aktivitet'] as const
type TabValue = (typeof TABS)[number]
const DEFAULT_TAB: TabValue = 'items'
const JUMP_HIGHLIGHT_MS = 1500

function isValidTab(value: string): value is TabValue {
  return (TABS as readonly string[]).includes(value)
}

interface CycleDetailPageProps {
  cycle: CycleDetail
  items: CycleItemRow[]
  cyclePartial: CyclePartial
  readOnly: boolean
}

export function CycleDetailPage({
  cycle,
  items: initialItems,
  cyclePartial,
  readOnly,
}: CycleDetailPageProps) {
  const swrKey = `compliance-audit-items:${cycle.id}`
  const { mutate: globalMutate } = useSWRConfig()

  const { data } = useSWR<GetCycleItemsResult>(
    swrKey,
    async () => {
      const result = await getCycleItemsForCycle(cycle.id)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta kontrollposter')
      }
      return result.data
    },
    {
      fallbackData: { items: initialItems, cycle: cyclePartial },
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  )

  const items = data?.items ?? initialItems
  const [tab, setTab] = useState<TabValue>(DEFAULT_TAB)
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null)

  // Sync tab from URL hash on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.slice(1)
    if (isValidTab(hash)) {
      setTab(hash)
    }
  }, [])

  // Push tab selection into the URL hash (replace-state, no navigation).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const nextHash = `#${tab}`
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash)
    }
  }, [tab])

  const handleTabChange = (next: string) => {
    if (isValidTab(next)) setTab(next)
  }

  // ---- Mutation handlers with optimistic UI + toast recovery -----------

  const replaceRow = useCallback(
    (updated: CycleItemRow) => {
      void globalMutate<GetCycleItemsResult>(
        swrKey,
        (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            items: prev.items.map((i) => (i.id === updated.id ? updated : i)),
          }
        },
        { revalidate: false }
      )
    },
    [globalMutate, swrKey]
  )

  const reloadOnFailure = useCallback(() => {
    void globalMutate<GetCycleItemsResult>(swrKey)
  }, [globalMutate, swrKey])

  const handleBedomningChange = useCallback(
    async (row: CycleItemRow, next: EfterlevnadsBedomning | null) => {
      const result = await updateItemBedomning({
        itemId: row.id,
        efterlevnadsbedomning: next,
      })
      if (!result.success || !result.data) {
        toast.error('Kunde inte uppdatera bedömning', {
          description: result.error,
        })
        reloadOnFailure()
        return
      }
      replaceRow(result.data.item)
    },
    [replaceRow, reloadOnFailure]
  )

  const handleMotiveringChange = useCallback(
    async (row: CycleItemRow, next: string | null) => {
      const result = await updateItemMotivering({
        itemId: row.id,
        motivering: next,
      })
      if (!result.success || !result.data) {
        toast.error('Kunde inte uppdatera motivering', {
          description: result.error,
        })
        reloadOnFailure()
        return
      }
      replaceRow(result.data.item)
    },
    [replaceRow, reloadOnFailure]
  )

  const handleSign = useCallback(
    async (row: CycleItemRow) => {
      const result = await signOffItem(row.id)
      if (!result.success || !result.data) {
        toast.error('Kunde inte signera', { description: result.error })
        reloadOnFailure()
        return
      }
      replaceRow(result.data.item)
    },
    [replaceRow, reloadOnFailure]
  )

  const handleUnsign = useCallback(
    async (row: CycleItemRow) => {
      const result = await unsignOffItem(row.id)
      if (!result.success || !result.data) {
        toast.error('Kunde inte ångra signering', { description: result.error })
        reloadOnFailure()
        return
      }
      replaceRow(result.data.item)
    },
    [replaceRow, reloadOnFailure]
  )

  // ---- Progress context + jump handlers ---------------------------------

  const jumpTo = useCallback((id: string) => {
    const el = document.querySelector<HTMLElement>(
      `[data-cycle-item-id="${id}"]`
    )
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedRowId(id)
    window.setTimeout(() => {
      setHighlightedRowId((current) => (current === id ? null : current))
    }, JUMP_HIGHLIGHT_MS)
  }, [])

  const jumpToFirstUnbedomd = useCallback(() => {
    const target = items.find((i) => i.efterlevnadsbedomning === null)
    if (target) jumpTo(target.id)
  }, [items, jumpTo])

  const jumpToFirstUnsigned = useCallback(() => {
    const target = items.find((i) => i.signedOffAt === null)
    if (target) jumpTo(target.id)
  }, [items, jumpTo])

  const bedomdaCount = useMemo(
    () => items.filter((i) => i.efterlevnadsbedomning !== null).length,
    [items]
  )
  const signeradeCount = useMemo(
    () => items.filter((i) => i.signedOffAt !== null).length,
    [items]
  )

  const contextValue: CycleItemsContextValue = useMemo(
    () => ({
      bedomdaCount,
      signeradeCount,
      totalCount: items.length,
      jumpToFirstUnbedomd,
      jumpToFirstUnsigned,
      ready: true,
    }),
    [
      bedomdaCount,
      signeradeCount,
      items.length,
      jumpToFirstUnbedomd,
      jumpToFirstUnsigned,
    ]
  )

  return (
    <CycleItemsProvider value={contextValue}>
      <div className="space-y-6">
        <CycleDetailHeader cycle={cycle} readOnly={readOnly} />

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="findings">Findings</TabsTrigger>
            <TabsTrigger value="rapport">Rapport</TabsTrigger>
            <TabsTrigger value="aktivitet">Aktivitet</TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <CycleItemsTab
              items={items}
              readOnly={readOnly}
              highlightedRowId={highlightedRowId}
              onBedomningChange={handleBedomningChange}
              onMotiveringChange={handleMotiveringChange}
              onSign={handleSign}
              onUnsign={handleUnsign}
            />
          </TabsContent>
          <TabsContent value="findings">
            <div className="p-6 text-sm italic text-muted-foreground">
              Hanteras i Story 21.7
            </div>
          </TabsContent>
          <TabsContent value="rapport">
            <div className="p-6 text-sm italic text-muted-foreground">
              Hanteras i Story 21.11–21.12
            </div>
          </TabsContent>
          <TabsContent value="aktivitet">
            <div className="p-6 text-sm italic text-muted-foreground">
              Hanteras i Story 21.13
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </CycleItemsProvider>
  )
}
