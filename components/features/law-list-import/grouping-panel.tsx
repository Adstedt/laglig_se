'use client'

/**
 * Story 24.7: editable grouping panel mounted inside the commit dialog.
 *
 * Owns the user-visible mechanics of the suggestion proposal:
 *   - Inline group rename (click-to-edit)
 *   - "Flytta till →" dropdown per row
 *   - "Lägg till grupp" button
 *   - "Övriga (utan grupp)" bucket
 *   - Provenance badges (Område / AI-förslag)
 *
 * Owns NO server-action or telemetry concerns — those live in the parent
 * (`<ImportReviewPage>`). State changes call back via the `onChange*`
 * callbacks; the parent is the source of truth for `groups` + `unassigned`.
 */

import type { ReactElement } from 'react'
import { Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface EditableGroup {
  name: string
  rowIds: string[]
  source: 'omrade' | 'llm' | 'user'
}

export interface RowMeta {
  title: string | null
  documentNumber: string | null
}

interface GroupingPanelProps {
  loading: boolean
  error: string | null
  degraded: string | null
  groups: EditableGroup[]
  unassignedRowIds: string[]
  rowMetaById: Map<string, RowMeta>
  onChangeGroups: (_next: EditableGroup[]) => void
  onChangeUnassigned: (_next: string[]) => void
  onMarkEdited: () => void
  onReProposeClick: () => void
}

const UNASSIGNED_KEY = '__unassigned__'

export function GroupingPanel({
  loading,
  error,
  degraded,
  groups,
  unassignedRowIds,
  rowMetaById,
  onChangeGroups,
  onChangeUnassigned,
  onMarkEdited,
  onReProposeClick,
}: GroupingPanelProps) {
  // ---------------------------------------------------------- Edit handlers

  function renameGroup(index: number, name: string): void {
    const next = groups.map((g, i) => (i === index ? { ...g, name } : g))
    onChangeGroups(next)
    onMarkEdited()
  }

  function removeGroup(index: number): void {
    const removed = groups[index]
    if (!removed) return
    const next = groups.filter((_, i) => i !== index)
    onChangeGroups(next)
    onChangeUnassigned([...unassignedRowIds, ...removed.rowIds])
    onMarkEdited()
  }

  function moveRowToGroup(rowId: string, targetKey: string): void {
    // Strip the row from wherever it currently is.
    const groupsWithout = groups.map((g) => ({
      ...g,
      rowIds: g.rowIds.filter((id) => id !== rowId),
    }))
    const unassignedWithout = unassignedRowIds.filter((id) => id !== rowId)

    if (targetKey === UNASSIGNED_KEY) {
      onChangeGroups(groupsWithout)
      onChangeUnassigned([...unassignedWithout, rowId])
    } else {
      const targetIdx = parseInt(targetKey, 10)
      if (Number.isNaN(targetIdx) || !groupsWithout[targetIdx]) return
      const next = groupsWithout.map((g, i) =>
        i === targetIdx ? { ...g, rowIds: [...g.rowIds, rowId] } : g
      )
      onChangeGroups(next)
      onChangeUnassigned(unassignedWithout)
    }
    onMarkEdited()
  }

  function addEmptyGroup(): void {
    onChangeGroups([
      ...groups,
      { name: 'Ny grupp', rowIds: [], source: 'user' },
    ])
    onMarkEdited()
  }

  // ------------------------------------------------------------------- Render

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Hämtar gruppförslag…
        </span>
      </div>
    )
  }

  if (error !== null) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Kunde inte föreslå grupper: {error}
      </div>
    )
  }

  // Group dropdown options — every group + "Övriga".
  const groupOptions = groups.map((g, idx) => ({
    key: idx.toString(),
    label: g.name,
  }))

  return (
    <div className="space-y-3" data-testid="grouping-panel">
      {/* Top bar — re-propose link + degraded banner */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Granska och justera grupperna nedan innan du skapar listan.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={onReProposeClick}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Föreslå om
        </Button>
      </div>

      {degraded && (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          data-testid="grouping-degraded-banner"
        >
          {degraded}
        </div>
      )}

      {/* Proposed groups */}
      {groups.length === 0 && unassignedRowIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Inga grupper föreslagna.
        </p>
      ) : null}

      {groups.map((group, idx) => (
        <div
          // Stable key — must NOT include `group.name` because that changes
          // on every keystroke during inline rename, which would unmount the
          // input and lose focus mid-edit.
          key={idx}
          className="rounded-md border bg-card"
          data-testid={`grouping-panel-group-${idx}`}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Input
              value={group.name}
              onChange={(e) => renameGroup(idx, e.target.value)}
              className="h-8 max-w-[220px] text-sm font-medium"
              aria-label="Gruppnamn"
            />
            <span className="text-xs text-muted-foreground">
              ({group.rowIds.length}{' '}
              {group.rowIds.length === 1 ? 'rad' : 'rader'})
            </span>
            <SourceBadge source={group.source} />
            <div className="ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeGroup(idx)}
                aria-label="Ta bort gruppen"
                title="Ta bort gruppen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {group.rowIds.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Inga rader. Använd &quot;Flytta till →&quot; på rader nedan för
              att lägga till.
            </p>
          ) : (
            <ul className="divide-y">
              {group.rowIds.map((rowId) => (
                <RowItem
                  key={rowId}
                  rowId={rowId}
                  meta={rowMetaById.get(rowId) ?? null}
                  groupOptions={groupOptions}
                  currentKey={idx.toString()}
                  onChange={(targetKey) => moveRowToGroup(rowId, targetKey)}
                />
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* Övriga — unassigned bucket */}
      <div
        className="rounded-md border bg-muted/30"
        data-testid="grouping-panel-unassigned"
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="text-sm font-medium">Övriga (utan grupp)</span>
          <span className="text-xs text-muted-foreground">
            ({unassignedRowIds.length}{' '}
            {unassignedRowIds.length === 1 ? 'rad' : 'rader'})
          </span>
        </div>
        {unassignedRowIds.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Inga ogrupperade rader.
          </p>
        ) : (
          <ul className="divide-y">
            {unassignedRowIds.map((rowId) => (
              <RowItem
                key={rowId}
                rowId={rowId}
                meta={rowMetaById.get(rowId) ?? null}
                groupOptions={groupOptions}
                currentKey={UNASSIGNED_KEY}
                onChange={(targetKey) => moveRowToGroup(rowId, targetKey)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Add group */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={addEmptyGroup}
      >
        <Plus className="h-3.5 w-3.5" />
        Lägg till grupp
      </Button>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface RowItemProps {
  rowId: string
  meta: RowMeta | null
  groupOptions: Array<{ key: string; label: string }>
  currentKey: string
  onChange: (_targetKey: string) => void
}

function RowItem({
  rowId,
  meta,
  groupOptions,
  currentKey,
  onChange,
}: RowItemProps) {
  return (
    <li
      className="flex items-center gap-3 px-3 py-2"
      data-testid={`grouping-panel-row-${rowId}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{meta?.title ?? rowId}</p>
        {meta?.documentNumber && (
          <p className="truncate text-xs text-muted-foreground">
            {meta.documentNumber}
          </p>
        )}
      </div>
      <Select value={currentKey} onValueChange={onChange}>
        <SelectTrigger
          className="h-8 w-[160px] text-xs"
          aria-label="Flytta till"
        >
          <SelectValue placeholder="Flytta till" />
        </SelectTrigger>
        <SelectContent>
          {groupOptions.map((opt) => (
            <SelectItem key={opt.key} value={opt.key}>
              {opt.label}
            </SelectItem>
          ))}
          <SelectItem value={UNASSIGNED_KEY}>Övriga</SelectItem>
        </SelectContent>
      </Select>
    </li>
  )
}

interface SourceBadgeProps {
  source: EditableGroup['source']
}

function SourceBadge({ source }: SourceBadgeProps): ReactElement | null {
  if (source === 'user') return null
  const label = source === 'omrade' ? 'Område' : 'AI-förslag'
  return (
    <Badge
      variant="secondary"
      className={cn(
        'h-5 text-[10px] font-normal',
        source === 'llm' &&
          'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200'
      )}
    >
      {label}
    </Badge>
  )
}
