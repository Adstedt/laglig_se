'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { WorkspaceActivityEntry } from '@/app/actions/workspace-activity'

interface ActivityExpandedRowProps {
  activity: WorkspaceActivityEntry
}

/**
 * Labels for payload keys that make it into the diff. Unknown keys fall
 * through as-is (typed slightly dimmer) so future additions don't break.
 */
const PAYLOAD_KEY_LABELS: Record<string, string> = {
  title: 'Titel',
  status: 'Status',
  compliance_status: 'Efterlevnadsstatus',
  priority: 'Prioritet',
  assignee: 'Ansvarig',
  due_date: 'Förfallodatum',
  labels: 'Etiketter',
  subject: 'Ämne',
  comment: 'Kommentar',
  document_type: 'Dokumenttyp',
  version_number: 'Version',
  restored_from_version: 'Återställd från version',
  new_version_number: 'Ny version',
  change_summary: 'Sammanfattning',
  source_file: 'Källfil',
  source: 'Källa',
  is_fulfilled: 'Uppfylld',
  bevis_required: 'Bevis krävs',
  text: 'Text',
}

/**
 * Keys always hidden from the diff. Either they duplicate what the sentence
 * already conveys, or they're foreign-key UUIDs pointing at an entity
 * that's already surfaced via the resolved "Länkad till" block.
 */
const ALWAYS_SUPPRESSED_KEYS = new Set<string>([
  // Long-text sentinels — the logger already collapses these to `{changed:true}`
  'description',
  'business_context',
  'compliance_actions',
  // Foreign keys resolved by the entity resolver
  'list_item_id',
  'task_id',
  'document_id',
  'workspace_document_id',
  'file_id',
  'law_list_item_id',
  // Snapshot titles duplicated by the sentence
  'law_title',
  'list_item_title',
  'task_title',
  'workspace_document_title',
  'file_name',
  // Internal linkage
  'comment_id',
])

/**
 * Some keys are only redundant when the *sentence* already used them. Suppress
 * these only when the action matches.
 */
const SUPPRESSED_PER_ACTION: Record<string, Set<string>> = {
  // Sentence shows the old → new values inline
  status_changed: new Set(['compliance_status']),
  status_updated: new Set(['status']),
  priority_changed: new Set(['priority']),
  priority_updated: new Set(['priority']),
  assignee_updated: new Set(['assignee']),
  due_date_updated: new Set(['due_date']),
  title_updated: new Set(['title']),
  document_status_changed: new Set(['status']),
  document_version_saved: new Set(['version_number']),
  document_version_restored: new Set([
    'restored_from_version',
    'new_version_number',
  ]),
  requirement_created: new Set(['text']),
  requirement_deleted: new Set(['text']),
  // Sentence + recipients block already carry template + recipient
  notification_sent: new Set(['template', 'recipient', 'recipients']),
  // Lifecycle create already shows title in the sentence
  created: new Set(['title']),
  deleted: new Set(['title']),
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '–'
  if (typeof v === 'string') return v.length ? v : '–'
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nej'
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.length === 0 ? '–' : v.join(', ')
  return JSON.stringify(v)
}

function humanKey(key: string): string {
  return (
    PAYLOAD_KEY_LABELS[key] ??
    key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  )
}

export function ActivityExpandedRow({ activity }: ActivityExpandedRowProps) {
  const [showTechnical, setShowTechnical] = useState(false)

  const oldP = asRecord(activity.old_value)
  const newP = asRecord(activity.new_value)

  const suppressed = new Set<string>(ALWAYS_SUPPRESSED_KEYS)
  const perAction = SUPPRESSED_PER_ACTION[activity.action]
  if (perAction) perAction.forEach((k) => suppressed.add(k))

  const allKeys = Array.from(
    new Set([
      ...(oldP ? Object.keys(oldP) : []),
      ...(newP ? Object.keys(newP) : []),
    ])
  )
  const visibleKeys = allKeys.filter((k) => !suppressed.has(k))

  const recipient =
    typeof newP?.['recipient'] === 'string'
      ? (newP['recipient'] as string)
      : null
  const recipients = Array.isArray(newP?.['recipients'])
    ? (newP?.['recipients'] as string[])
    : null
  const hasRecipients = !!(recipient || (recipients && recipients.length))

  const hasDiff = visibleKeys.length > 0
  const hasSecondary = !!activity.secondary
  const hasAnyExtraInfo = hasDiff || hasRecipients || hasSecondary

  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-4 text-sm">
      {!hasAnyExtraInfo && (
        <p className="text-sm text-muted-foreground italic">
          Inga ytterligare detaljer utöver meningen ovan.
        </p>
      )}

      {hasDiff && (
        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Detaljer
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            {visibleKeys.map((key) => {
              const oldV = oldP?.[key]
              const newV = newP?.[key]
              const bothPresent = oldV !== undefined && newV !== undefined

              // Long-text sentinels get a friendly note instead of raw JSON
              if (
                key === 'description' ||
                key === 'business_context' ||
                key === 'compliance_actions'
              ) {
                return (
                  <FragmentPair
                    key={key}
                    label={humanKey(key)}
                    content={
                      <span className="text-muted-foreground italic">
                        Innehåll ändrat
                      </span>
                    }
                  />
                )
              }

              return (
                <FragmentPair
                  key={key}
                  label={humanKey(key)}
                  content={
                    bothPresent ? (
                      <span className="flex items-center gap-2 flex-wrap">
                        <ValueChip>{renderValue(oldV)}</ValueChip>
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <ValueChip>{renderValue(newV)}</ValueChip>
                      </span>
                    ) : (
                      <ValueChip>{renderValue(newV ?? oldV)}</ValueChip>
                    )
                  }
                />
              )
            })}
          </dl>
        </section>
      )}

      {hasRecipients && (
        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mottagare
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recipient && (
              <Badge variant="secondary" className="font-normal">
                {recipient}
              </Badge>
            )}
            {recipients?.map((r) => (
              <Badge key={r} variant="secondary" className="font-normal">
                {r}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {hasSecondary && activity.secondary && (
        <section>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Länkad till
          </div>
          {activity.secondary.href && !activity.secondary.deleted ? (
            <Link
              href={activity.secondary.href}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {activity.secondary.label}
            </Link>
          ) : (
            <span className="text-muted-foreground line-through">
              {activity.secondary.label}
            </span>
          )}
        </section>
      )}

      <div className="pt-2 border-t border-border/60">
        <button
          type="button"
          onClick={() => setShowTechnical((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            'text-muted-foreground hover:text-foreground transition-colors'
          )}
          aria-expanded={showTechnical}
        >
          {showTechnical ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Teknisk information
        </button>
        {showTechnical && (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <TechPair label="Åtgärd" value={activity.action} />
            <TechPair label="Entitetstyp" value={activity.entity_type} />
            <TechPair label="Entitets-ID" value={activity.entity_id} mono />
          </dl>
        )}
      </div>
    </div>
  )
}

function ValueChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-background border border-border px-2 py-0.5 text-xs font-medium text-foreground">
      {children}
    </span>
  )
}

function FragmentPair({
  label,
  content,
}: {
  label: string
  content: React.ReactNode
}) {
  return (
    <>
      <dt className="text-xs font-medium text-muted-foreground pt-1">
        {label}
      </dt>
      <dd className="text-sm">{content}</dd>
    </>
  )
}

function TechPair({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn(mono && 'font-mono')}>{value}</dd>
    </>
  )
}
