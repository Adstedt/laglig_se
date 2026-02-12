'use client'

/**
 * DraggableColumnHeader — Shared wrapper for column reorder via native
 * HTML5 drag-and-drop. Avoids @dnd-kit DndContext (which injects <div>
 * elements that are invalid inside <table>).
 *
 * Pinned columns (select, dragHandle, actions, etc.) should NOT
 * be wrapped with this component — render a plain <TableHead> instead.
 */

import { useState, useCallback } from 'react'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { CSSProperties, ReactNode } from 'react'

interface DraggableColumnHeaderProps {
  /** Column ID used as the drag identifier */
  id: string
  children: ReactNode
  /** Called when a column is dropped onto this header */
  onReorder: (_activeId: string, _overId: string) => void
  style?: CSSProperties
  className?: string
}

export function DraggableColumnHeader({
  id,
  children,
  onReorder,
  style,
  className,
}: DraggableColumnHeaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLTableCellElement>) => {
      // Don't initiate drag from resize handles
      const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY)
      if (elementAtPoint?.closest('[role="separator"]')) {
        e.preventDefault()
        return
      }
      e.dataTransfer.setData('text/column-id', id)
      e.dataTransfer.effectAllowed = 'move'
      setIsDragging(true)
    },
    [id]
  )

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLTableCellElement>) => {
      if (!e.dataTransfer.types.includes('text/column-id')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    },
    []
  )

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLTableCellElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const sourceId = e.dataTransfer.getData('text/column-id')
      if (sourceId && sourceId !== id) {
        onReorder(sourceId, id)
      }
    },
    [id, onReorder]
  )

  return (
    <TableHead
      draggable
      style={style}
      className={cn(
        className,
        'cursor-grab active:cursor-grabbing select-none',
        isDragging && 'opacity-50 bg-muted',
        isDragOver && 'bg-accent'
      )}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </TableHead>
  )
}
