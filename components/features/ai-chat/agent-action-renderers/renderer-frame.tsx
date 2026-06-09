'use client'

/**
 * Story 14.23: shared frame for the per-type approval renderers — the
 * "spine & whisper" treatment (see _prototypes/14.23-agent-action-card-v2.html).
 *
 * Owns the visual shell so every per-type renderer only supplies its
 * `badge` (type label), `summary` (the one-line "what will happen"),
 * editable `children`, and `approved` summary:
 *  - Non-compact (single card): a near-borderless surface with the warm→sage
 *    spine, a whisper eyebrow ("Förslag · {badge}"), the lead line, editable
 *    fields behind a "Justera" disclosure, and a `rounded-md` footer.
 *  - Compact (batch row): a single collapsed line (status dot + type icon +
 *    lead + inline approve/reject), expandable to the editable fields.
 * Four lifecycle states throughout (PENDING / APPROVED / REJECTED / EXPIRED).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  Check,
  ChevronRight,
  Link2,
  ListChecks,
  ListTodo,
  Loader2,
  SlidersHorizontal,
  StickyNote,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { PendingAgentActionStatus } from '@prisma/client'

export const LABEL_CLS =
  'text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground'

/** Type label → icon for the compact row + eyebrow glyph. */
const TYPE_ICON: Record<string, LucideIcon> = {
  Uppgift: ListTodo,
  Koppling: Link2,
  Kravpunkt: ListChecks,
  Status: Activity,
  Anteckning: StickyNote,
  Tilldela: UserPlus,
}

/**
 * Debounced (500ms) persistence of edited params. Skips the initial mount and
 * only fires while the row is PENDING (AC 7).
 */
export function useDebouncedParamsChange(
  onParamsChange: (_params: Record<string, unknown>) => void,
  params: Record<string, unknown>,
  enabled: boolean
): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const mountedRef = useRef(false)
  const serialized = JSON.stringify(params)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (!enabled) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(
      () => onParamsChange(JSON.parse(serialized)),
      500
    )
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, enabled])
}

type DotState = 'pending' | 'approved' | 'muted'

function StatusDot({ state }: { state: DotState }) {
  if (state === 'approved') {
    return (
      <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-emerald-500" />
    )
  }
  if (state === 'muted') {
    return (
      <span className="inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-muted-foreground/40" />
    )
  }
  return (
    <span
      className="agent-dot-pending relative inline-block h-[7px] w-[7px] shrink-0 rounded-full"
      style={{ background: 'hsl(var(--spine-top))' }}
    />
  )
}

function Eyebrow({ badge, dot }: { badge: string; dot: DotState }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 text-[11px] tracking-[0.04em] text-muted-foreground">
      <StatusDot state={dot} />
      <span className="font-medium">Förslag</span>
      <span className="text-muted-foreground/40">·</span>
      <span>{badge}</span>
    </div>
  )
}

/** Near-borderless surface with the signature spine (single-card shell). */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-card/70 shadow-[0_1px_2px_rgba(0,0,0,0.025)] ring-1 ring-border/45">
      <span className="agent-spine pointer-events-none absolute bottom-3 left-0 top-3 w-[3px]" />
      <div className="py-4 pl-5 pr-4">{children}</div>
    </div>
  )
}

interface ActionRendererFrameProps {
  status: PendingAgentActionStatus
  compact?: boolean
  /** Action-type label — eyebrow text + row icon lookup. */
  badge: string
  /** One-line "what will happen" — the lead line + collapsed-row text. */
  summary: ReactNode
  /** Editable body (behind disclosure). */
  children: ReactNode
  /** Read-only summary with entity link (APPROVED). */
  approved: ReactNode
  onApprove: () => void
  onReject: () => void
  isSubmitting: boolean
  /** Disable approve (e.g. empty required field). */
  canApprove?: boolean
  /**
   * Story 14.24: optional extra control in the PENDING footer (non-compact),
   * rendered between Godkänn and Avvisa — e.g. the draft card's "Öppna i editor".
   * Other renderers omit it (backward-compatible).
   */
  secondaryAction?: ReactNode
}

export function ActionRendererFrame({
  status,
  compact = false,
  badge,
  summary,
  children,
  approved,
  onApprove,
  onReject,
  isSubmitting,
  canApprove = true,
  secondaryAction,
}: ActionRendererFrameProps) {
  const [open, setOpen] = useState(false)
  const Icon = TYPE_ICON[badge] ?? ListTodo

  // ── COMPACT (batch row) ────────────────────────────────────────────────
  if (compact) {
    if (status !== 'PENDING') {
      const isApproved = status === 'APPROVED'
      const isInEditor = status === 'IN_EDITOR'
      return (
        <div className="flex items-center gap-2.5 px-2 py-2">
          <StatusDot state={isApproved ? 'approved' : 'muted'} />
          <span title={badge} className="inline-flex shrink-0">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[13.5px]',
              isApproved
                ? 'text-foreground'
                : isInEditor
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground line-through'
            )}
          >
            {summary}
          </span>
          {isApproved ? (
            <span className="inline-flex items-center gap-1 px-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Godkänd
            </span>
          ) : (
            <span className="px-1 text-[11px] text-muted-foreground">
              {isInEditor
                ? 'Öppen i editor'
                : status === 'REJECTED'
                  ? 'Avvisad'
                  : 'Utgången'}
            </span>
          )}
        </div>
      )
    }
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40">
          <StatusDot state="pending" />
          <span title={badge} className="inline-flex shrink-0">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <CollapsibleTrigger className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[13.5px] text-foreground">
              {summary}
            </span>
          </CollapsibleTrigger>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onApprove}
              disabled={isSubmitting || !canApprove}
              title="Godkänn"
              aria-label="Godkänn"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-600 disabled:pointer-events-none disabled:opacity-40"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={isSubmitting}
              title="Avvisa"
              aria-label="Avvisa"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <CollapsibleContent>
          <div className="mb-1 ml-[26px] mr-2 space-y-3 border-l border-border/45 pl-3 pt-1">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  // ── NON-COMPACT (single card) ──────────────────────────────────────────
  if (status === 'APPROVED') {
    return (
      <Shell>
        <Eyebrow badge={badge} dot="approved" />
        <div className="space-y-2">{approved}</div>
      </Shell>
    )
  }
  if (status === 'REJECTED') {
    return (
      <Shell>
        <Eyebrow badge={badge} dot="muted" />
        <p className="text-[14px] text-muted-foreground line-through">
          {summary}
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground/70">
          Avvisat — inget genomfördes.
        </p>
      </Shell>
    )
  }
  if (status === 'EXPIRED') {
    return (
      <Shell>
        <Eyebrow badge={badge} dot="muted" />
        <p className="text-[13px] text-muted-foreground">
          Förslaget har gått ut
        </p>
        <p className="mt-0.5 text-[14px] text-muted-foreground line-through">
          {summary}
        </p>
      </Shell>
    )
  }
  // Story 14.24 (AC 19): IN_EDITOR — the draft is open in the document editor.
  // No Godkänn here (finalize happens in the editor); Avvisa still deletes it.
  if (status === 'IN_EDITOR') {
    return (
      <Shell>
        <Eyebrow badge={badge} dot="pending" />
        <p className="text-[14.5px] leading-snug text-foreground">{summary}</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Öppet i editor — slutför där eller avvisa
        </p>
        <div className="mt-3 flex items-center gap-1">
          <button
            type="button"
            onClick={onReject}
            disabled={isSubmitting}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Avvisa
          </button>
        </div>
      </Shell>
    )
  }

  // PENDING
  return (
    <Shell>
      <Eyebrow badge={badge} dot="pending" />
      <p className="text-[14.5px] leading-snug text-foreground">{summary}</p>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="group/just mt-2 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
          <SlidersHorizontal className="h-3 w-3" />
          Justera
          <ChevronRight className="h-3 w-3 transition-transform duration-200 group-data-[state=open]/just:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 space-y-3 border-t border-border/45 pt-3">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-3.5 flex items-center gap-1">
        <button
          type="button"
          onClick={onApprove}
          disabled={isSubmitting || !canApprove}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Godkänn
        </button>
        {secondaryAction}
        <button
          type="button"
          onClick={onReject}
          disabled={isSubmitting}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          Avvisa
        </button>
      </div>
    </Shell>
  )
}
