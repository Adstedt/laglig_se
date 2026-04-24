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
}

export function KravpunkterSnapshotList({
  snapshot,
  listItemId,
  itemResponsibleUserId,
}: KravpunkterSnapshotListProps) {
  const { data: linkedArtifacts } = useSWR(
    listItemId ? `linked-artifacts:${listItemId}` : null,
    async () => {
      const result = await getLinkedArtifactsForListItem(listItemId)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta bevis')
      }
      return result.data.artifacts
    },
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  )

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

  return (
    <div className="space-y-2">
      {frozenAt ? (
        <p className="text-xs text-muted-foreground">
          Ögonblicksbild från{' '}
          <span className="font-medium text-foreground">{frozenAt}</span>
        </p>
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
                effectiveAssigneeId
                  ? (membersById.get(effectiveAssigneeId) ?? null)
                  : null
              }
              assigneeInherited={isInherited}
            />
          )
        })}
      </ul>
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
}: {
  req: KravpunkterSnapshotRequirement
  bevisForReq: LinkedArtifact[]
  assignee: WorkspaceMemberOption | null
  assigneeInherited: boolean
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
              <Badge
                variant="outline"
                className="h-5 shrink-0 border-amber-500/60 text-xs font-normal text-amber-700 dark:text-amber-400"
                title="Denna kravpunkt kräver bevis men saknar bifogade filer eller dokument"
              >
                <AlertCircle className="mr-1 h-3 w-3" />
                Saknar bevis
              </Badge>
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
