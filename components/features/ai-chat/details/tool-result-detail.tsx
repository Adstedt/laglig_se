'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolResultDetailProps {
  toolName: string
  data: unknown
}

/**
 * Generic tool result renderer.
 * Renders structured data as text-only key-value pairs (no dangerouslySetInnerHTML).
 */
export function ToolResultDetail({ toolName, data }: ToolResultDetailProps) {
  // Unwrap ToolResponse shape: { data: T, _meta: {...} }
  const payload =
    data && typeof data === 'object' && 'data' in data
      ? (data as Record<string, unknown>).data
      : data

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Resultat från <span className="font-medium">{toolName}</span>
      </p>
      <DataNode value={payload} depth={0} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recursive data renderer
// ---------------------------------------------------------------------------

function DataNode({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-muted-foreground italic">null</span>
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return <span className="text-sm break-words">{String(value)}</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span className="text-xs text-muted-foreground italic">Tom lista</span>
      )
    }
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div
            key={i}
            className="rounded-md border border-border/60 bg-muted/20 p-2.5"
          >
            <DataNode value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([key]) => key !== '_meta'
    )
    if (entries.length === 0) {
      return (
        <span className="text-xs text-muted-foreground italic">
          Tomt objekt
        </span>
      )
    }

    return (
      <div className="space-y-1.5">
        {entries.map(([key, val]) => (
          <CollapsibleEntry key={key} label={key} value={val} depth={depth} />
        ))}
      </div>
    )
  }

  return <span className="text-sm">{String(value)}</span>
}

function CollapsibleEntry({
  label,
  value,
  depth,
}: {
  label: string
  value: unknown
  depth: number
}) {
  const isComplex =
    typeof value === 'object' && value !== null && !Array.isArray(value)
  const isArray = Array.isArray(value)
  const needsCollapse = (isComplex || isArray) && depth > 0

  const [open, setOpen] = useState(!needsCollapse)

  const displayLabel = label
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')

  if (needsCollapse) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          {displayLabel}
        </button>
        {open && (
          <div className="ml-4 mt-1">
            <DataNode value={value} depth={depth + 1} />
          </div>
        )}
      </div>
    )
  }

  // Simple key-value
  return (
    <div
      className={cn(
        'flex gap-2',
        isComplex || isArray ? 'flex-col' : 'items-baseline'
      )}
    >
      <span className="text-xs font-medium text-muted-foreground shrink-0">
        {displayLabel}:
      </span>
      <DataNode value={value} depth={depth + 1} />
    </div>
  )
}
