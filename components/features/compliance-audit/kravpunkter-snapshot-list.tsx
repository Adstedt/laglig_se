'use client'

/**
 * Epic 21 Story 21.16 — Kravpunkter snapshot renderer.
 *
 * Visual language aligned with `legal-document-modal/kravpunkter-checklist.tsx`
 * so the cycle-item modal and the law-list-item modal feel like the same
 * product. Flat single-line rows with a right-aligned bevis pill + chevron;
 * each row is a `Collapsible` that opens to show comment + linked bevis.
 *
 * Data split:
 *   - FROZEN (from `item.kravpunkterSnapshot`): text, comment, is_fulfilled,
 *     bevis_required. Point-in-time copy, immune to post-freeze edits
 *     (FR4 frozen-scope guarantee).
 *   - LIVE (via SWR → `getLinkedArtifactsForListItem`): bevis currently
 *     linked to each requirement. Auditors need present-day evidence. The
 *     seal transaction (Story 21.9) captures SHA-256 of each bevis at seal
 *     time if tamper-evidence is needed downstream.
 */

import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import useSWR from 'swr'
import {
  AlertCircle,
  ChevronRight,
  Circle,
  CircleCheck,
  FileText,
  MessageSquare,
  Paperclip,
  Plus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  getLinkedArtifactsForListItem,
  type LinkedArtifact,
} from '@/app/actions/linked-artifacts'
import {
  getWorkspaceMembers,
  type WorkspaceMemberOption,
} from '@/app/actions/document-list'
import type {
  KravpunkterSnapshot,
  KravpunkterSnapshotRequirement,
} from '@/app/actions/compliance-audit-cycle'

interface KravpunkterSnapshotListProps {
  snapshot: KravpunkterSnapshot | null | undefined
  /** Required for the live bevis fetch — same SWR key as `LinkedArtifactsPanel`
   *  (`linked-artifacts:${listItemId}`) so both surfaces share one cache. */
  listItemId: string
  /** Item-level responsible user, used as the fallback when a kravpunkt has
   *  no explicit `responsible_user_id` — mirrors the `effectiveAssignee`
   *  pattern on `legal-document-modal/kravpunkter-checklist.tsx`. */
  itemResponsibleUserId?: string | null
  /** Quick-win affordance: when set, the "Saknar bevis" pill becomes a
   *  clickable button that opens the FindingEditor pre-filled for the
   *  clicked kravpunkt. Pass `undefined` (default) in readOnly contexts so
   *  the pill stays a passive indicator. */
  onSuggestFindingForRequirement?: (_requirementId: string) => void
}

export function KravpunkterSnapshotList({
  snapshot,
  listItemId,
  itemResponsibleUserId,
  onSuggestFindingForRequirement,
}: KravpunkterSnapshotListProps) {
  // SWR key MUST match `LinkedArtifactsPanel`'s key + return shape so all
  // three consumers (this list, the right-panel "Att uppmärksamma" card,
  // and the LinkedArtifactsPanel itself) share one cache. Returning a
  // narrower shape here would corrupt the cache and leave the panel
  // stuck in loading state.
  const { data: linkedArtifactsResult } = useSWR(
    listItemId ? `linked-artifacts:${listItemId}` : null,
    async () => {
      const result = await getLinkedArtifactsForListItem(listItemId)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta bevis')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  )
  const linkedArtifacts = linkedArtifactsResult?.artifacts

  // Workspace members lookup — used to resolve each kravpunkt's
  // `responsible_user_id` (frozen at materialise time) to a name + avatar
  // so auditors can see who to contact when bevis is missing. Shared SWR
  // key across any surface that needs the same lookup.
  const { data: members } = useSWR(
    'workspace-members',
    async () => {
      const result = await getWorkspaceMembers()
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta medlemmar')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  )

  const membersById = useMemo(() => {
    const map = new Map<string, WorkspaceMemberOption>()
    ;(members ?? []).forEach((m) => map.set(m.id, m))
    return map
  }, [members])

  const frozenAt = snapshot?.frozen_at
    ? (() => {
        try {
          return format(new Date(snapshot.frozen_at), 'd MMM yyyy HH:mm', {
            locale: sv,
          })
        } catch {
          return snapshot.frozen_at
        }
      })()
    : null

  if (!snapshot || snapshot.requirements.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm italic text-muted-foreground">
        Inga kravpunkter fanns när kontrollen skapades.
      </div>
    )
  }

  // v2 (2026-04-25): when ALL kravpunkter resolve to the same effective
  // assignee, surface them once as a "Ansvarig" stripe at the top and
  // suppress per-row avatars. Cuts the visual noise of 7 identical AA
  // avatars in the common case (everything inherits from the lagansvarig).
  // When any kravpunkt has a different effective assignee → no stripe,
  // per-row avatars show on every row so the differences are visible.
  const effectiveAssigneeIds = snapshot.requirements.map(
    (r) => r.responsible_user_id ?? itemResponsibleUserId ?? null
  )
  const uniqueAssigneeIds = new Set(
    effectiveAssigneeIds.filter((id): id is string => id !== null)
  )
  const dominantAssigneeId =
    uniqueAssigneeIds.size === 1 ? [...uniqueAssigneeIds][0]! : null
  const dominantAssignee = dominantAssigneeId
    ? (membersById.get(dominantAssigneeId) ?? null)
    : null
  const hideRowAvatars = dominantAssignee !== null

  return (
    <div className="space-y-2">
      {frozenAt ? (
        <p className="text-xs text-muted-foreground">
          Ögonblicksbild från{' '}
          <span className="font-medium text-foreground">{frozenAt}</span>
        </p>
      ) : null}

      {dominantAssignee ? (
        <DominantAssigneeStripe assignee={dominantAssignee} />
      ) : null}

      <ul className="space-y-1" data-testid="kravpunkter-snapshot-list">
        {snapshot.requirements.map((req) => {
          const effectiveAssigneeId =
            req.responsible_user_id ?? itemResponsibleUserId ?? null
          const isInherited =
            req.responsible_user_id === null &&
            itemResponsibleUserId !== null &&
            itemResponsibleUserId !== undefined
          return (
            <KravpunktRow
              key={req.id}
              req={req}
              bevisForReq={filterArtifactsByRequirement(
                linkedArtifacts,
                req.id
              )}
              assignee={
                hideRowAvatars
                  ? null
                  : effectiveAssigneeId
                    ? (membersById.get(effectiveAssigneeId) ?? null)
                    : null
              }
              assigneeInherited={hideRowAvatars ? false : isInherited}
              {...(onSuggestFindingForRequirement
                ? { onSuggestFinding: onSuggestFindingForRequirement }
                : {})}
            />
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dominant-assignee stripe (item ② of v2 audit-flow alignment)
// ---------------------------------------------------------------------------

function DominantAssigneeStripe({
  assignee,
}: {
  assignee: WorkspaceMemberOption
}) {
  const display = assignee.name?.trim() || assignee.email
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
      <Avatar className="h-7 w-7">
        <AvatarImage src={assignee.avatarUrl ?? undefined} />
        <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
          {getInitials(assignee.name, assignee.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Ansvarig för alla kravpunkter
        </div>
        <div className="truncate text-sm text-foreground">{display}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function KravpunktRow({
  req,
  bevisForReq,
  assignee,
  assigneeInherited,
  onSuggestFinding,
}: {
  req: KravpunkterSnapshotRequirement
  bevisForReq: LinkedArtifact[]
  assignee: WorkspaceMemberOption | null
  assigneeInherited: boolean
  onSuggestFinding?: (_requirementId: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const missingRequiredBevis = req.bevis_required && bevisForReq.length === 0

  // Structure + classes mirror `legal-document-modal/kravpunkter-checklist.tsx:489-632`
  // exactly — plain flex `<div>` row (not a wrapping button), hover:bg-muted/50,
  // px-2.5 py-2, gap-2.5. The whole row is a CollapsibleTrigger asChild so
  // any click inside expands; we swap the ref's editable text + AssigneeEditor
  // for read-only equivalents since snapshot data is frozen.
  return (
    <li className="group rounded-md transition-colors">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setIsExpanded((v) => !v)
              }
            }}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors',
              'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            {/* 1. Fulfilled indicator — matches `FulfilledToggle` (CircleCheck
             *  outlined, green stroke). Plain icons since snapshot is read-only. */}
            {req.is_fulfilled ? (
              <CircleCheck
                className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500"
                strokeWidth={2}
                aria-label="Uppfylld"
              />
            ) : (
              <Circle
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
                aria-label="Ej uppfylld"
              />
            )}

            {/* 2. Text — same classes as reference button minus the edit affordance */}
            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  'block w-full text-left text-sm leading-snug',
                  req.is_fulfilled && 'text-muted-foreground'
                )}
              >
                {req.text}
              </span>
            </div>

            {/* 3. Comment-presence icon (1:1 with ref) */}
            {req.comment && req.comment.trim() ? (
              <MessageSquare
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                aria-label="Kommentar finns"
              />
            ) : null}

            {/* 4. Evidence badge (1:1 with ref) */}
            {bevisForReq.length > 0 ? (
              <Badge
                variant="secondary"
                className="h-5 shrink-0 text-xs font-normal"
              >
                <Paperclip className="mr-1 h-3 w-3" />
                {bevisForReq.length} bevis
              </Badge>
            ) : missingRequiredBevis ? (
              onSuggestFinding ? (
                // Clickable affordance: opens the FindingEditor pre-filled
                // with this kravpunkt so the auditor can document the gap
                // without re-picking item + krav from dropdowns. Stops
                // propagation so the parent CollapsibleTrigger doesn't also
                // toggle the row's expand state.
                //
                // Hover treatment: morphs from "Saknar bevis" (status) to
                // "Skapa anmärkning" (action) so the click affordance reads
                // instantly. Layered with absolute positioning to keep width
                // stable — the wider hover state determines the pill width.
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSuggestFinding(req.id)
                        }}
                        onKeyDown={(e) => {
                          // Don't let Enter/Space bubble — the parent row
                          // already handles those for expand. Swallow at the
                          // button level so only its own click handler fires.
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation()
                          }
                        }}
                        className={cn(
                          'group relative inline-flex h-5 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-normal transition-all duration-150',
                          // Default: amber outline, transparent fill (status look)
                          'border-amber-500/60 text-amber-700 dark:text-amber-400',
                          // Hover: filled amber background + brighter border (action look)
                          'cursor-pointer hover:border-amber-500 hover:bg-amber-100 hover:text-amber-900 dark:hover:bg-amber-900/40 dark:hover:text-amber-100',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                        )}
                      >
                        {/* Width sentinel — invisible, sets the pill's width
                         *  to whichever state's text is wider so the morph
                         *  doesn't shift layout. */}
                        <span className="invisible inline-flex items-center px-2.5">
                          <Plus className="mr-1 h-3 w-3" />
                          Skapa anmärkning
                        </span>

                        {/* Default state — visible until hover */}
                        <span className="absolute inset-0 inline-flex items-center justify-center px-2.5 transition-opacity duration-150 group-hover:opacity-0">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Saknar bevis
                        </span>

                        {/* Hover state — fades in on hover */}
                        <span className="absolute inset-0 inline-flex items-center justify-center px-2.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          <Plus className="mr-1 h-3 w-3" />
                          Skapa anmärkning
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="font-medium">Saknar bevis</div>
                      <div className="text-muted-foreground">
                        Klicka för att skapa anmärkning kopplad till kravpunkten
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Badge
                  variant="outline"
                  className="h-5 shrink-0 border-amber-500/60 text-xs font-normal text-amber-700 dark:text-amber-400"
                  title="Denna kravpunkt kräver bevis men saknar bifogade filer eller dokument"
                >
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Saknar bevis
                </Badge>
              )
            ) : null}

            {/* 5. Assignee avatar — readonly equivalent of the ref's
             *  AssigneeEditor. Same `h-7 w-7`, same `bg-primary/10 text-primary`
             *  fallback, same `ring-1 ring-dashed ring-muted-foreground/40`
             *  for inherited. */}
            <div className="shrink-0">
              <AssigneeAvatar
                assignee={assignee}
                inherited={assigneeInherited}
              />
            </div>

            {/* 6. Chevron — same classes as ref */}
            <button
              type="button"
              onClick={(e) => {
                // Stop bubble so outer CollapsibleTrigger doesn't double-toggle.
                e.stopPropagation()
                setIsExpanded((v) => !v)
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
              aria-label={isExpanded ? 'Dölj detaljer' : 'Visa detaljer'}
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {/* Indentation + typography mirrors `legal-document-modal/kravpunkter-checklist.tsx:799`
           *  (EvidenceList) and `:963` (CommentSection): `ml-7` aligns past the
           *  FulfilledToggle, tiny muted `text-xs` section labels (not
           *  uppercase/tracking), plain italic muted empty-state copy. */}

          {/* Comment — frozen from snapshot */}
          <div className="mb-2 ml-7 mr-2 mt-1">
            {req.comment ? (
              <>
                <p className="mb-1 text-xs text-muted-foreground">Kommentar</p>
                <p className="whitespace-pre-wrap rounded-md border border-transparent px-3 py-2 text-sm text-muted-foreground">
                  {req.comment}
                </p>
              </>
            ) : (
              <p className="px-3 py-1 text-xs italic text-muted-foreground/70">
                Ingen kommentar sparad när kontrollen skapades.
              </p>
            )}
          </div>

          {/* Bevis — live, filtered to this requirement */}
          <div className="mb-2 ml-7 mt-1 space-y-1">
            {bevisForReq.length === 0 ? (
              <p className="px-2 py-1 text-xs italic text-muted-foreground/70">
                {req.bevis_required
                  ? 'Inga bevis kopplade — kravpunkten kräver bevis.'
                  : 'Inga bevis kopplade.'}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {bevisForReq.map((a) => (
                  <ArtifactRow key={`${a.kind}-${a.id}`} artifact={a} />
                ))}
              </ul>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Assignee avatar
// ---------------------------------------------------------------------------

function AssigneeAvatar({
  assignee,
  inherited,
}: {
  assignee: WorkspaceMemberOption | null
  inherited: boolean
}) {
  // Matches the `AssigneeEditor` SelectTrigger visual in
  // `components/features/document-list/table-cell-editors/assignee-editor.tsx:105-141`
  // exactly: h-7 w-7, AvatarFallback bg-primary/10 text-primary, dashed ring
  // when inherited. Reserves a fixed h-7 w-7 slot when nobody is assigned so
  // rows stay aligned.
  const slotClass = 'flex h-7 w-7 items-center justify-center'

  if (!assignee) {
    return <span className={slotClass} aria-hidden="true" />
  }

  const display = assignee.name?.trim() || assignee.email

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={slotClass}>
            <Avatar
              className={cn(
                'h-7 w-7',
                inherited && 'ring-1 ring-dashed ring-muted-foreground/40'
              )}
            >
              <AvatarImage src={assignee.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                {getInitials(assignee.name, assignee.email)}
              </AvatarFallback>
            </Avatar>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="font-medium">{display}</div>
          <div className="text-muted-foreground">
            {inherited ? 'Ärvd från lagansvarig' : 'Ansvarig för kravpunkten'}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Copy of `getInitials` from `assignee-editor.tsx:57` so initials render
// identically across surfaces.
function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterArtifactsByRequirement(
  artifacts: LinkedArtifact[] | undefined,
  requirementId: string
): LinkedArtifact[] {
  if (!artifacts) return []
  return artifacts.filter((a) =>
    a.requirements.some((r) => r.id === requirementId)
  )
}

// Matches `legal-document-modal/kravpunkter-checklist.tsx:806-838` — plain
// row with small muted file icon, truncated name, subtle hover bg.
function ArtifactRow({ artifact }: { artifact: LinkedArtifact }) {
  const isFile = artifact.kind === 'file'
  const name = isFile ? artifact.filename : artifact.title
  return (
    <li className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/30">
      {isFile ? (
        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="flex-1 truncate">{name ?? '—'}</span>
    </li>
  )
}
