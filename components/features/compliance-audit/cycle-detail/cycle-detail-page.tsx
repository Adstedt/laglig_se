'use client'

/**
 * Story 21.5 — Orchestrator client component for /laglistor/kontroller/[cycleId].
 * Owns SWR data + mutation callbacks + the progress-cluster context so the
 * header and the items table share a single source of truth.
 *
 * Story 21.7 — Extended to host the Findings tab + the per-item row drawer's
 * findings affordance. Findings SWR cache is hoisted here (SF-1) so both the
 * tab and the drawer consume the same array.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CycleDetailHeader } from './cycle-detail-header'
import { CycleItemsTab } from './cycle-items-tab'
import { CycleFindingsTab } from './cycle-findings-tab'
import { CompleteCycleDialog } from './complete-cycle-dialog'
import { RevertCycleDialog } from './revert-cycle-dialog'
import { SealCycleDialog } from './seal-cycle-dialog'
import { CycleRapportTab } from './cycle-rapport-tab'
import { CycleItemModal } from '@/components/features/compliance-audit/cycle-item-modal'
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
import {
  listFindingsForCycle,
  type FindingRow,
  type ListFindingsResult,
} from '@/app/actions/compliance-finding'
import {
  completeCycle,
  revertCycleToPagaende,
  sealCycle,
  getDraftEvidenceDocuments,
  type CycleDetail,
  type DraftDocumentSummary,
} from '@/app/actions/compliance-audit-cycle'
import {
  complianceAuditItemsKey,
  complianceFindingsKey,
  complianceDraftEvidenceDocsKey,
} from '@/lib/swr-keys/compliance-audit'
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
  initialFindings: FindingRow[]
  cyclePartial: CyclePartial
  readOnly: boolean
  // Story 21.6 — runtime flag for the Revert affordance. Server-resolved
  // via `canCompleteOrRevertCycle` in the RSC route shell so the dropdown
  // can render a disabled-with-tooltip state for MEMBER-not-lead-auditor
  // without a client-side DB lookup. Always `false` when cycle.status is
  // not AVSLUTAD (RSC skips the lookup for other states).
  canRevert: boolean
  // Story 21.9 — runtime flag for the Seal affordance. Server-resolved via
  // `canSealCycle` in the RSC route shell (OWNER/ADMIN with `audit:seal`
  // scope OR the cycle's lead auditor). Always `false` when cycle.status
  // is not AVSLUTAD.
  canSeal: boolean
}

export function CycleDetailPage({
  cycle,
  items: initialItems,
  initialFindings,
  cyclePartial,
  readOnly,
  canRevert,
  canSeal,
}: CycleDetailPageProps) {
  const itemsKey = complianceAuditItemsKey(cycle.id)
  const findingsKey = complianceFindingsKey(cycle.id)
  const draftDocsKey = complianceDraftEvidenceDocsKey(cycle.id)
  const { mutate: globalMutate } = useSWRConfig()

  // Story 21.6 — local cycle state seeded from the RSC prop. Post-transition
  // updates write here in-place (mirrors the items replaceRow pattern below)
  // so the header badge, Rapport-tab branch, and Åtgärder dropdown all
  // reflect the new status without a router.refresh round-trip.
  //
  // SF-5: re-sync the effect on `cycle.updatedAt` (not `cycle.id`) so cross-
  // user mutations propagating through `revalidatePath` land in local state.
  // `updatedAt` bumps on every UPDATE so this key is reliably unique per
  // server-side cycle mutation.
  const [localCycle, setLocalCycle] = useState<CycleDetail>(cycle)
  useEffect(() => {
    setLocalCycle(cycle)
  }, [cycle, cycle.updatedAt])

  // Story 21.6 — lifecycle dialog state.
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [completeSubmitting, setCompleteSubmitting] = useState(false)
  const [revertDialogOpen, setRevertDialogOpen] = useState(false)
  const [revertSubmitting, setRevertSubmitting] = useState(false)
  // Story 21.9 — seal dialog state.
  const [sealDialogOpen, setSealDialogOpen] = useState(false)
  const [sealSubmitting, setSealSubmitting] = useState(false)

  const { data: itemsData } = useSWR<GetCycleItemsResult>(
    itemsKey,
    async () => {
      const result = await getCycleItemsForCycle(cycle.id)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta kontrollens dokument')
      }
      return result.data
    },
    {
      fallbackData: { items: initialItems, cycle: cyclePartial },
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  )

  const { data: findingsData } = useSWR<ListFindingsResult>(
    findingsKey,
    async () => {
      const result = await listFindingsForCycle({ cycleId: cycle.id })
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta anmärkningar')
      }
      return result.data
    },
    {
      fallbackData: { findings: initialFindings },
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  )

  // v0.5 — DRAFT-status styrdokument in scope, surfaced in SealCycleDialog.
  // No fallbackData: data isn't required at first paint; the dialog only
  // mounts on user click, by which time SWR has resolved. If still pending
  // when dialog opens, draftDocuments renders as [] (override gate idle).
  const { data: draftDocsData } = useSWR<{
    draftDocuments: DraftDocumentSummary[]
  }>(
    draftDocsKey,
    async () => {
      const result = await getDraftEvidenceDocuments(cycle.id)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta utkast-styrdokument')
      }
      return result.data
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  )

  const items = itemsData?.items ?? initialItems
  const draftDocuments = draftDocsData?.draftDocuments ?? []
  const findings = findingsData?.findings ?? initialFindings

  const [tab, setTab] = useState<TabValue>(DEFAULT_TAB)
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null)
  // Story 21.16 — modal state. `selectedItemId` opens the CycleItemModal on
  // the matching row; `focusFindingId` scrolls + highlights a finding card
  // inside the modal (used by Findings-tab drill-in + shareable URLs).
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [focusFindingId, setFocusFindingId] = useState<string | null>(null)

  // Sync tab from URL hash + item/finding from query params on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.slice(1)
    if (isValidTab(hash)) {
      setTab(hash)
    }
    const params = new URLSearchParams(window.location.search)
    const itemParam = params.get('item')
    const findingParam = params.get('finding')
    if (itemParam) setSelectedItemId(itemParam)
    if (findingParam) setFocusFindingId(findingParam)
  }, [])

  // Push tab selection into the URL hash (replace-state, no navigation).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const nextHash = `#${tab}`
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash)
    }
  }, [tab])

  // Story 21.16 — sync selectedItemId + focusFindingId to URL query params.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (selectedItemId) {
      params.set('item', selectedItemId)
    } else {
      params.delete('item')
    }
    if (focusFindingId) {
      params.set('finding', focusFindingId)
    } else {
      params.delete('finding')
    }
    const search = params.toString()
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
    if (
      nextUrl !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    ) {
      window.history.replaceState(null, '', nextUrl)
    }
  }, [selectedItemId, focusFindingId])

  const handleTabChange = (next: string) => {
    if (isValidTab(next)) setTab(next)
  }

  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId)
    setFocusFindingId(null)
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedItemId(null)
    setFocusFindingId(null)
  }, [])

  // Story 21.16 — Findings-tab drill-in. Clicking a finding card body opens
  // the Items-tab modal on the finding's parent law with the finding focused.
  const handleFindingClick = useCallback(
    (finding: FindingRow) => {
      if (!finding.lawListItemId) {
        // Cycle-level findings (no parent item) — navigate logically is not
        // possible. Could open the editor here in a future iteration.
        return
      }
      // Find the CycleItemRow whose lawListItemId matches the finding's.
      // The items array is small enough that a linear scan is fine.
      const matchingItem = items.find(
        (i) => i.lawListItemId === finding.lawListItemId
      )
      if (!matchingItem) return
      setSelectedItemId(matchingItem.id)
      setFocusFindingId(finding.id)
      setTab('items')
    },
    [items]
  )

  // ---- Mutation handlers with optimistic UI + toast recovery -----------

  const replaceRow = useCallback(
    (updated: CycleItemRow) => {
      void globalMutate<GetCycleItemsResult>(
        itemsKey,
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
    [globalMutate, itemsKey]
  )

  const reloadOnFailure = useCallback(() => {
    void globalMutate<GetCycleItemsResult>(itemsKey)
  }, [globalMutate, itemsKey])

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

  // Story 21.6 — cycle lifecycle handlers. Reuse the `replaceRow` pattern
  // at the cycle level: the server action returns the authoritative
  // CycleDetail, we write it into local state, and every consumer (header
  // badge, Rapport tab branch, Åtgärder dropdown) re-renders from the new
  // status without router.refresh.
  const handleCompleteCycle = useCallback(async () => {
    setCompleteSubmitting(true)
    try {
      const result = await completeCycle(localCycle.id)
      if (!result.success || !result.data) {
        toast.error('Kunde inte slutföra kontrollen', {
          description: result.error,
        })
        return
      }
      setLocalCycle(result.data.cycle)
      setCompleteDialogOpen(false)
      toast.success('Kontrollen är avslutad')
    } finally {
      setCompleteSubmitting(false)
    }
  }, [localCycle.id])

  const handleRevertCycle = useCallback(async () => {
    setRevertSubmitting(true)
    try {
      const result = await revertCycleToPagaende(localCycle.id)
      if (!result.success || !result.data) {
        toast.error('Kunde inte återställa kontrollen', {
          description: result.error,
        })
        return
      }
      setLocalCycle(result.data.cycle)
      setRevertDialogOpen(false)
      toast.success('Kontrollen är återställd till Pågående')
    } finally {
      setRevertSubmitting(false)
    }
  }, [localCycle.id])

  // Story 21.9 — seal handler. Calls sealCycle with optional overrideReason;
  // on success, flips localCycle status to SEALED which ripples to the header
  // banner, the dropdown, and the Rapport tab.
  const handleSealCycle = useCallback(
    async (overrideReason?: string) => {
      setSealSubmitting(true)
      try {
        const result = await sealCycle({
          cycleId: localCycle.id,
          ...(overrideReason !== undefined ? { overrideReason } : {}),
        })
        if (!result.success || !result.data) {
          toast.error('Kunde inte fastställa kontrollen', {
            description: result.error,
          })
          return
        }
        setLocalCycle(result.data.cycle)
        setSealDialogOpen(false)
        toast.success('Kontrollen är fastställd')
      } finally {
        setSealSubmitting(false)
      }
    },
    [localCycle.id]
  )

  // Story 21.7 — finding mutation reconciler. Mirrors replaceRow.
  // Replace-in-place when the finding exists; prepend when it's a new create
  // (listFindingsForCycle sorts created_at desc + id desc, so newest → top).
  const handleFindingMutation = useCallback(
    (updated: FindingRow) => {
      void globalMutate<ListFindingsResult>(
        findingsKey,
        (prev) => {
          if (!prev) return { findings: [updated] }
          const existing = prev.findings.some((f) => f.id === updated.id)
          if (existing) {
            return {
              ...prev,
              findings: prev.findings.map((f) =>
                f.id === updated.id ? updated : f
              ),
            }
          }
          return { ...prev, findings: [updated, ...prev.findings] }
        },
        { revalidate: false }
      )
    },
    [globalMutate, findingsKey]
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

  const findingCounts = useMemo(
    () => ({
      open: findings.filter((f) => f.closedAt === null).length,
      closed: findings.filter((f) => f.closedAt !== null).length,
    }),
    [findings]
  )

  // Story 21.6 — pendingTasks approximation for the Complete dialog advisory.
  // Derived inline from findings: openFindings with a linked corrective-action
  // task. The `closedAt === null` check is implicit via `f` being from the
  // open-findings set, but we keep both conditions explicit for clarity.
  // See CompleteCycleDialog JSDoc for the approximation contract.
  const pendingTasks = useMemo(
    () =>
      findings.filter(
        (f) => f.correctiveActionTaskId !== null && f.closedAt === null
      ).length,
    [findings]
  )

  // Story 21.9 — open AVVIKELSE projection for the SealCycleDialog override
  // gate. AVVIKELSE is the only finding type that gates seal; OBSERVATION
  // and FORBATTRING are non-blocking per the PO-approved Gate-with-override
  // policy. Project to a minimal summary shape so the dialog can SURFACE
  // each open avvikelse (per UX feedback 2026-04-24 — count alone forces
  // users to context-switch to the Anmärkningar tab).
  const openAvvikelser = useMemo(
    () =>
      findings
        .filter((f) => f.type === 'AVVIKELSE' && f.closedAt === null)
        .map((f) => ({
          id: f.id,
          title: f.title,
          severity: f.severity,
          contextLabel: f.lawListItem
            ? `${f.lawListItem.documentNumber} ${f.lawListItem.title}`
            : null,
        })),
    [findings]
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
        <CycleDetailHeader
          cycle={localCycle}
          readOnly={readOnly}
          findingCounts={findingCounts}
          totalCount={items.length}
          signeradeCount={signeradeCount}
          canRevert={canRevert}
          canSeal={canSeal}
          onCompleteClick={() => setCompleteDialogOpen(true)}
          onRevertClick={() => setRevertDialogOpen(true)}
          onSealClick={() => setSealDialogOpen(true)}
        />

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="items">Dokument</TabsTrigger>
            <TabsTrigger value="findings">Anmärkningar</TabsTrigger>
            <TabsTrigger value="rapport">Rapport</TabsTrigger>
            <TabsTrigger value="aktivitet">Aktivitet</TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <CycleItemsTab
              items={items}
              readOnly={readOnly}
              highlightedRowId={highlightedRowId}
              selectedItemId={selectedItemId}
              onSelectItem={handleSelectItem}
              onBedomningChange={handleBedomningChange}
              onMotiveringChange={handleMotiveringChange}
              onSign={handleSign}
              onUnsign={handleUnsign}
              findings={findings}
            />
          </TabsContent>
          <TabsContent value="findings">
            <CycleFindingsTab
              cycleId={localCycle.id}
              findings={findings}
              readOnly={readOnly}
              items={items}
              onFindingMutation={handleFindingMutation}
              onFindingClick={handleFindingClick}
            />
          </TabsContent>
          <TabsContent value="rapport">
            <CycleRapportTab
              cycleId={localCycle.id}
              cycleStatus={localCycle.status}
              cycleName={localCycle.name}
            />
          </TabsContent>
          <TabsContent value="aktivitet">
            <div className="p-6 text-sm italic text-muted-foreground">
              Hanteras i Story 21.13
            </div>
          </TabsContent>
        </Tabs>

        {/* Story 21.6 — cycle lifecycle dialogs (siblings of Tabs, above the
            item modal so their z-order is above the read-only/edit surfaces). */}
        <CompleteCycleDialog
          open={completeDialogOpen}
          onOpenChange={setCompleteDialogOpen}
          onConfirm={handleCompleteCycle}
          isSubmitting={completeSubmitting}
          openFindings={findingCounts.open}
          pendingTasks={pendingTasks}
        />
        <RevertCycleDialog
          open={revertDialogOpen}
          onOpenChange={setRevertDialogOpen}
          onConfirm={handleRevertCycle}
          isSubmitting={revertSubmitting}
        />
        {/* Story 21.9 — seal dialog with conditional override gate. */}
        <SealCycleDialog
          open={sealDialogOpen}
          onOpenChange={setSealDialogOpen}
          onConfirm={handleSealCycle}
          isSubmitting={sealSubmitting}
          openAvvikelser={openAvvikelser}
          draftDocuments={draftDocuments}
          pendingTasks={pendingTasks}
        />

        {/* Story 21.16 — cycle-item modal. `selectedItemId === null` → closed. */}
        <CycleItemModal
          item={
            selectedItemId
              ? (items.find((i) => i.id === selectedItemId) ?? null)
              : null
          }
          findings={findings}
          items={items}
          cycleId={localCycle.id}
          cycleName={localCycle.name}
          readOnly={readOnly}
          focusFindingId={focusFindingId}
          onClose={handleCloseModal}
          onBedomningChange={handleBedomningChange}
          onMotiveringChange={handleMotiveringChange}
          onSign={handleSign}
          onUnsign={handleUnsign}
          onFindingMutation={handleFindingMutation}
        />
      </div>
    </CycleItemsProvider>
  )
}
