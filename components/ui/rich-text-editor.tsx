'use client'

/**
 * Rich Text Editor Component
 * Jira-style WYSIWYG editor using Tiptap with mentions, images, tables, etc.
 */

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { useCallback, useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
  Code,
  Quote,
  Minus,
  ImageIcon,
  Table as TableIcon,
  Smile,
  AtSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Common emoji categories for quick access
const EMOJI_LIST = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😅',
  '😂',
  '🤣',
  '😊',
  '😇',
  '🙂',
  '😉',
  '😌',
  '😍',
  '🥰',
  '😘',
  '😋',
  '😎',
  '🤓',
  '🧐',
  '🤔',
  '👍',
  '👎',
  '👏',
  '🙌',
  '🤝',
  '✅',
  '❌',
  '⚠️',
  '🔥',
  '💯',
  '⭐',
  '💡',
  '📌',
  '📎',
  '🎯',
  '🚀',
  '💪',
  '🎉',
  '✨',
  '❤️',
]

interface RichTextEditorProps {
  content: string
  onChange: (_content: string) => void
  onBlur?: () => void
  placeholder?: string
  editable?: boolean
  className?: string
  members?: Array<{ id: string; name: string; email: string }>
}

export function RichTextEditor({
  content,
  onChange,
  onBlur,
  placeholder = 'Skriv här...',
  editable = true,
  className,
  members = [],
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-md my-2',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full my-4',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class:
            'border border-border bg-muted px-3 py-2 text-left font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-border px-3 py-2',
        },
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    onBlur: () => {
      onBlur?.()
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'focus:outline-none',
          'min-h-[100px] px-3 py-2',
          '[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2',
          '[&_li]:my-0.5',
          '[&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic',
          '[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm',
          '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md',
          '[&_hr]:my-4 [&_hr]:border-border',
          '[&_img]:max-w-full [&_img]:rounded-md'
        ),
      },
    },
  })

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  const setLink = useCallback(() => {
    if (!editor) return

    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    if (url === null) return

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const addImage = useCallback(() => {
    if (!editor) return

    const url = window.prompt('Bild-URL')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const insertTable = useCallback(() => {
    if (!editor) return
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run()
  }, [editor])

  const insertMention = useCallback(
    (name: string) => {
      if (!editor) return
      editor.chain().focus().insertContent(`@${name} `).run()
    },
    [editor]
  )

  const insertEmoji = useCallback(
    (emoji: string) => {
      if (!editor) return
      editor.chain().focus().insertContent(emoji).run()
    },
    [editor]
  )

  if (!editor) {
    return (
      <div
        className={cn(
          'rounded-md border border-input bg-background animate-pulse',
          className
        )}
      >
        <div className="h-10 border-b border-border bg-muted/30" />
        <div className="h-[100px]" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-md border border-input bg-background',
        'focus-within:ring-1 focus-within:ring-ring',
        className
      )}
    >
      {/* Toolbar */}
      <EditorToolbar
        editor={editor}
        onSetLink={setLink}
        onAddImage={addImage}
        onInsertTable={insertTable}
        onInsertMention={insertMention}
        onInsertEmoji={insertEmoji}
        members={members}
      />

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  )
}

interface EditorToolbarProps {
  editor: Editor
  onSetLink: () => void
  onAddImage: () => void
  onInsertTable: () => void
  onInsertMention: (_name: string) => void
  onInsertEmoji: (_emoji: string) => void
  members: Array<{ id: string; name: string; email: string }>
}

function EditorToolbar({
  editor,
  onSetLink,
  onAddImage,
  onInsertTable,
  onInsertMention,
  onInsertEmoji,
  members,
}: EditorToolbarProps) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1 bg-muted/30">
      {/* Text formatting */}
      <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Fetstil"
        title="Fetstil (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Kursiv"
        title="Kursiv (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('underline')}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        aria-label="Understruken"
        title="Understruken (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('strike')}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Genomstruken"
        title="Genomstruken"
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('code')}
        onPressedChange={() => editor.chain().focus().toggleCode().run()}
        aria-label="Kod"
        title="Inline kod"
      >
        <Code className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Lists */}
      <Toggle
        size="sm"
        pressed={editor.isActive('bulletList')}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Punktlista"
        title="Punktlista"
      >
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('orderedList')}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Numrerad lista"
        title="Numrerad lista"
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Block elements */}
      <Toggle
        size="sm"
        pressed={editor.isActive('blockquote')}
        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
        aria-label="Citat"
        title="Citat"
      >
        <Quote className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={() => editor.chain().focus().setHorizontalRule().run()}
        aria-label="Horisontell linje"
        title="Horisontell linje"
      >
        <Minus className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Link */}
      <Toggle
        size="sm"
        pressed={editor.isActive('link')}
        onPressedChange={onSetLink}
        aria-label="Länk"
        title="Lägg till länk"
      >
        <LinkIcon className="h-4 w-4" />
      </Toggle>

      {/* Image */}
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={onAddImage}
        aria-label="Bild"
        title="Lägg till bild"
      >
        <ImageIcon className="h-4 w-4" />
      </Toggle>

      {/* Table */}
      <Toggle
        size="sm"
        pressed={editor.isActive('table')}
        onPressedChange={onInsertTable}
        aria-label="Tabell"
        title="Infoga tabell"
      >
        <TableIcon className="h-4 w-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Mentions */}
      {members.length > 0 && (
        <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
          <PopoverTrigger asChild>
            <Toggle
              size="sm"
              pressed={mentionOpen}
              aria-label="Nämn"
              title="Nämn någon (@)"
            >
              <AtSign className="h-4 w-4" />
            </Toggle>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            <div className="max-h-48 overflow-y-auto">
              {members.map((member) => (
                <button
                  key={member.id}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                  onClick={() => {
                    onInsertMention(member.name || member.email)
                    setMentionOpen(false)
                  }}
                >
                  {member.name || member.email}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Emoji Picker */}
      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild>
          <Toggle
            size="sm"
            pressed={emojiOpen}
            aria-label="Emoji"
            title="Infoga emoji"
          >
            <Smile className="h-4 w-4" />
          </Toggle>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="grid grid-cols-10 gap-1">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                className="text-lg p-1 hover:bg-muted rounded transition-colors"
                onClick={() => {
                  onInsertEmoji(emoji)
                  setEmojiOpen(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex-1" />

      {/* Undo/Redo */}
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        aria-label="Ångra"
        title="Ångra (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        aria-label="Gör om"
        title="Gör om (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </Toggle>
    </div>
  )
}

/**
 * Renders HTML content as read-only formatted text
 * Uses DOMPurify to sanitize HTML and prevent XSS attacks
 */
export function RichTextDisplay({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  // Sanitize HTML content to prevent XSS attacks
  const sanitizedContent = useMemo(() => {
    if (!content || content === '<p></p>') return ''
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'strike',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'a',
        'img',
        'blockquote',
        'pre',
        'code',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'hr',
        'span',
        'div',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
    })
  }, [content])

  if (!sanitizedContent) {
    return (
      <p className={cn('text-muted-foreground italic', className)}>
        Ingen beskrivning
      </p>
    )
  }

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        '[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2',
        '[&_li]:my-0.5',
        '[&_a]:text-primary [&_a]:underline',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic',
        '[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm',
        '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md',
        '[&_img]:max-w-full [&_img]:rounded-md',
        '[&_table]:border-collapse [&_table]:w-full [&_table]:my-4',
        '[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold',
        '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}
