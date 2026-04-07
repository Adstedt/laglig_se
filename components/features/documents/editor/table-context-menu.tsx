'use client'

import { type Editor } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Rows,
  Columns,
  Trash2,
  TableCellsMerge,
  TableCellsSplit,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'

interface Position {
  x: number
  y: number
}

interface TableContextMenuProps {
  editor: Editor
}

export function TableContextMenu({ editor }: TableContextMenuProps) {
  const [position, setPosition] = useState<Position | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setPosition(null), [])

  useEffect(() => {
    const editorEl = editor.view.dom

    const handleContextMenu = (e: MouseEvent) => {
      // Only show if cursor is inside a table
      if (!editor.isActive('table')) return

      e.preventDefault()
      setPosition({ x: e.clientX, y: e.clientY })
    }

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }

    editorEl.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      editorEl.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, close])

  if (!position) return null

  const items: Array<
    | {
        label: string
        icon: React.ElementType
        action: () => void
        disabled: boolean
        destructive?: boolean
      }
    | 'separator'
  > = [
    {
      label: 'Lägg till rad ovanför',
      icon: ArrowUp,
      action: () => editor.chain().focus().addRowBefore().run(),
      disabled: !editor.can().addRowBefore(),
    },
    {
      label: 'Lägg till rad under',
      icon: ArrowDown,
      action: () => editor.chain().focus().addRowAfter().run(),
      disabled: !editor.can().addRowAfter(),
    },
    {
      label: 'Lägg till kolumn vänster',
      icon: ArrowLeft,
      action: () => editor.chain().focus().addColumnBefore().run(),
      disabled: !editor.can().addColumnBefore(),
    },
    {
      label: 'Lägg till kolumn höger',
      icon: ArrowRight,
      action: () => editor.chain().focus().addColumnAfter().run(),
      disabled: !editor.can().addColumnAfter(),
    },
    'separator',
    {
      label: 'Ta bort rad',
      icon: Rows,
      action: () => editor.chain().focus().deleteRow().run(),
      disabled: !editor.can().deleteRow(),
    },
    {
      label: 'Ta bort kolumn',
      icon: Columns,
      action: () => editor.chain().focus().deleteColumn().run(),
      disabled: !editor.can().deleteColumn(),
    },
    'separator',
    {
      label: 'Slå samman celler',
      icon: TableCellsMerge,
      action: () => editor.chain().focus().mergeCells().run(),
      disabled: !editor.can().mergeCells(),
    },
    {
      label: 'Dela cell',
      icon: TableCellsSplit,
      action: () => editor.chain().focus().splitCell().run(),
      disabled: !editor.can().splitCell(),
    },
    'separator',
    {
      label: 'Ta bort tabell',
      icon: Trash2,
      action: () => editor.chain().focus().deleteTable().run(),
      disabled: !editor.can().deleteTable(),
      destructive: true,
    },
  ]

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] overflow-hidden rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, i) => {
        if (item === 'separator') {
          return <div key={i} className="my-1 h-px bg-border" />
        }
        const Icon = item.icon
        return (
          <button
            key={item.label}
            className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors
              ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent hover:text-accent-foreground cursor-default'}
              ${item.destructive && !item.disabled ? 'text-destructive hover:text-destructive' : ''}
            `}
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) {
                item.action()
                close()
              }
            }}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        )
      })}
    </div>,
    document.body
  )
}
