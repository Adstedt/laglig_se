'use client'

import { Extension, type Editor, type Range } from '@tiptap/core'
import Suggestion, {
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react'
import { createPortal } from 'react-dom'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Table,
  ImageIcon,
  Minus,
  type LucideIcon,
} from 'lucide-react'

interface CommandItem {
  title: string
  icon: LucideIcon
  command: (_props: { editor: Editor; range: Range }) => void
}

const COMMANDS: CommandItem[] = [
  {
    title: 'Rubrik 1',
    icon: Heading1,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 1 })
        .run()
    },
  },
  {
    title: 'Rubrik 2',
    icon: Heading2,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 2 })
        .run()
    },
  },
  {
    title: 'Rubrik 3',
    icon: Heading3,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode('heading', { level: 3 })
        .run()
    },
  },
  {
    title: 'Punktlista',
    icon: List,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Numrerad lista',
    icon: ListOrdered,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Tabell',
    icon: Table,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run()
    },
  },
  {
    title: 'Bild',
    icon: ImageIcon,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/png,image/jpeg,image/gif,image/webp'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        const { uploadDocumentImage } = await import('./image-upload')
        const slashExt = editor.extensionManager.extensions.find(
          (e) => e.name === 'slashCommand'
        )
        const documentId =
          (slashExt?.options as { documentId?: string })?.documentId ?? ''
        const url = await uploadDocumentImage(file, documentId)
        if (url) {
          editor.chain().focus().setImage({ src: url }).run()
        }
      }
      input.click()
    },
  },
  {
    title: 'Horisontell linje',
    icon: Minus,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
]

interface CommandListRef {
  onKeyDown: (_props: SuggestionKeyDownProps) => boolean
}

interface CommandListProps {
  items: CommandItem[]
  command: (_item: CommandItem) => void
  clientRect?: (() => DOMRect | null) | null
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items, command, clientRect }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    // Position the menu
    useLayoutEffect(() => {
      if (!menuRef.current || !clientRect) return
      const rect = clientRect()
      if (!rect) return
      menuRef.current.style.position = 'fixed'
      menuRef.current.style.left = `${rect.left}px`
      menuRef.current.style.top = `${rect.bottom + 4}px`
    }, [clientRect])

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        if (item) {
          command(item)
        }
      },
      [items, command]
    )

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return null
    }

    return createPortal(
      <div
        ref={menuRef}
        className="z-50 w-56 overflow-hidden rounded-md border bg-popover p-1 shadow-md"
      >
        {items.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={item.title}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm ${
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => selectItem(index)}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {item.title}
            </button>
          )
        })}
      </div>,
      document.body
    )
  }
)
CommandList.displayName = 'CommandList'

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      documentId: '' as string,
      suggestion: {
        char: '/',
        startOfLine: true,
        items: ({ query }: { query: string }) => {
          return COMMANDS.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase())
          )
        },
        render: () => {
          let component: ReactRenderer<CommandListRef> | null = null

          return {
            onStart: (props: SuggestionProps<CommandItem>) => {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              })
            },
            onUpdate: (props: SuggestionProps<CommandItem>) => {
              component?.updateProps(props)
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                component?.destroy()
                return true
              }
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              component?.destroy()
            },
          }
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
