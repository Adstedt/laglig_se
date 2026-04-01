'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { generateHTML } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TiptapContent = Record<string, any>
import { EditorToolbar } from './editor-toolbar'
import { SlashCommandExtension } from './slash-command'
import { useDocumentAutosave } from '@/lib/hooks/use-document-autosave'
import { autosaveDocument } from '@/app/actions/documents'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Save,
  FileText,
  FileDown,
  Loader2,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { VersionHistoryPanel } from './version-history-panel'
import { VersionDiffView } from './version-diff-view'
import { TableContextMenu } from './table-context-menu'
import { DocumentStatusBadge } from '@/components/features/documents/document-status-badge'
import { StatusTransitionControls } from './status-transition-controls'
import { DocumentSettingsPanel } from './document-settings-panel'
import { isDocumentEditable } from '@/lib/utils/document-editability'
import { createDraftFromApproved } from '@/app/actions/documents'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { sanitizeFilename } from '@/lib/utils/sanitize-filename'

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just nu'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min sedan`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} tim sedan`
  const days = Math.floor(hours / 24)
  return `${days} d sedan`
}

interface DocumentEditorProps {
  documentId: string
  initialTitle: string
  initialContent: TiptapContent
  status: string
  versionNumber: number
  authorName: string
  documentNumber?: string | null | undefined
  reviewDate?: string | null | undefined
  documentType?: string | undefined
  latestComment?: {
    comment: string
    userName: string
    fromStatus: string
    toStatus: string
    createdAt: string
  } | null
}

export function DocumentEditor({
  documentId,
  initialTitle,
  initialContent,
  status,
  versionNumber,
  authorName,
  documentNumber,
  reviewDate,
  documentType,
  latestComment,
}: DocumentEditorProps) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [currentVersionNumber, setCurrentVersionNumber] =
    useState(versionNumber)
  const [currentStatus, setCurrentStatus] = useState(status)
  const titleRef = useRef(initialTitle)
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffFromId, setDiffFromId] = useState<string | undefined>()
  const [diffToId, setDiffToId] = useState<string | undefined>()
  const [creatingDraft, setCreatingDraft] = useState(false)
  const [exporting, setExporting] = useState(false)
  const editable = isDocumentEditable(currentStatus)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({ inline: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Börja skriva...' }),
      Underline,
      Link.configure({ openOnClick: false }),
      Color,
      TextStyle,
      Highlight.configure({ multicolor: true }),
      CharacterCount,
      Typography,
      SlashCommandExtension.configure({ documentId }),
    ],
    content: initialContent,
    editable,
    immediatelyRender: false,
  })

  // Sync editable state when status changes (e.g. APPROVED → DRAFT via "new version")
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // Shared helper: generate HTML + prepare plain JSON for server actions
  const prepareContent = useCallback((contentJson: object) => {
    const contentHtml = generateHTML(contentJson as Record<string, unknown>, [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({ inline: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Link.configure({ openOnClick: false }),
      Color,
      TextStyle,
      Highlight.configure({ multicolor: true }),
    ])
    return {
      plainJson: JSON.parse(JSON.stringify(contentJson)),
      html: String(contentHtml),
    }
  }, [])

  // Save: always updates current draft version in place
  const handleSave = useCallback(
    async (contentJson: object) => {
      const { plainJson, html } = prepareContent(contentJson)
      const result = await autosaveDocument(
        documentId,
        plainJson,
        titleRef.current !== initialTitle ? titleRef.current : undefined,
        html
      )
      return result.success
    },
    [documentId, initialTitle, prepareContent]
  )

  const { saveStatus, triggerSave } = useDocumentAutosave({
    editor,
    onSave: handleSave,
    initialContent,
  })

  // Ctrl/Cmd+S manual save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        triggerSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [triggerSave])

  const handleVersionRestore = useCallback(
    (newVersionNumber: number) => {
      setCurrentVersionNumber(newVersionNumber)
      router.refresh()
    },
    [router]
  )

  const handleCompare = useCallback((fromId: string, toId: string) => {
    setDiffFromId(fromId)
    setDiffToId(toId)
    setDiffOpen(true)
  }, [])

  const handleStatusChange = useCallback(
    (newStatus?: string) => {
      if (newStatus) {
        setCurrentStatus(newStatus)
      }
      router.refresh()
    },
    [router]
  )

  const handleCreateDraft = useCallback(async () => {
    setCreatingDraft(true)
    const result = await createDraftFromApproved(documentId)
    setCreatingDraft(false)
    if (result.success && result.data) {
      setCurrentStatus('DRAFT')
      setCurrentVersionNumber(result.data.versionNumber)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Kunde inte skapa ny version')
    }
  }, [documentId, router])

  const handleExport = useCallback(
    async (format: 'docx' | 'pdf') => {
      setExporting(true)
      try {
        const response = await fetch(
          `/api/workspace/documents/${documentId}/export?format=${format}`
        )
        if (!response.ok) {
          toast.error('Export misslyckades')
          return
        }
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const dateStr = new Date().toISOString().slice(0, 10)
        const filename = `${sanitizeFilename(title)}-v${currentVersionNumber}-${dateStr}.${format}`
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      } catch {
        toast.error('Export misslyckades')
      } finally {
        setExporting(false)
      }
    },
    [documentId, title, currentVersionNumber]
  )

  const saveStatusText = {
    idle: 'Sparad',
    saving: 'Sparar...',
    saved: 'Sparad',
    unsaved: 'Osparade ändringar',
    error: 'Kunde inte spara',
  }[saveStatus]

  return (
    <div className="flex flex-col h-full">
      {/* Read-only banner for non-editable documents */}
      {!editable && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
          {currentStatus === 'IN_REVIEW' &&
            'Detta dokument är under granskning och kan inte redigeras.'}
          {currentStatus === 'APPROVED' &&
            'Detta dokument är godkänt och kan inte redigeras.'}
          {currentStatus === 'SUPERSEDED' &&
            'Detta dokument har ersatts av en nyare version.'}
          {currentStatus === 'ARCHIVED' && 'Detta dokument är arkiverat.'}
        </div>
      )}

      {/* Metadata bar */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/workspace/documents')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Tillbaka
          </Button>
          <DocumentStatusBadge status={currentStatus} />
          <span className="text-sm text-muted-foreground">
            v{currentVersionNumber}
          </span>
          <span className="text-sm text-muted-foreground">{authorName}</span>
        </div>
        <div className="flex items-center gap-3">
          {editor && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {editor.storage.characterCount?.words() ?? 0} ord
            </span>
          )}
          <span
            className={cn(
              'text-sm',
              saveStatus === 'unsaved'
                ? 'text-amber-600'
                : saveStatus === 'error'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
            )}
          >
            {saveStatusText}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={exporting}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <FileDown className="mr-1 h-4 w-4" />
                    Exportera
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('docx')}>
                <FileText className="mr-2 h-4 w-4" />
                Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileDown className="mr-2 h-4 w-4" />
                PDF (.pdf)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DocumentSettingsPanel
            documentId={documentId}
            initialDocumentNumber={documentNumber ?? null}
            initialReviewDate={reviewDate ?? null}
            initialDocumentType={documentType ?? null}
            readOnly={!editable}
          />
          <VersionHistoryPanel
            documentId={documentId}
            currentVersionNumber={currentVersionNumber}
            onRestore={handleVersionRestore}
            onCompare={handleCompare}
          />
          {editable && (
            <Button
              size="sm"
              onClick={triggerSave}
              disabled={saveStatus === 'saving'}
            >
              <Save className="mr-1 h-4 w-4" />
              Spara
            </Button>
          )}
          <StatusTransitionControls
            documentId={documentId}
            currentStatus={currentStatus}
            onStatusChange={handleStatusChange}
            onCreateDraft={handleCreateDraft}
            creatingDraft={creatingDraft}
          />
        </div>
      </div>

      {/* Toolbar — only shown when editable */}
      {editor && editable && (
        <EditorToolbar editor={editor} documentId={documentId} />
      )}
      {editor && editable && <TableContextMenu editor={editor} />}

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto bg-muted/30 py-8">
        {/* Status change comment — above the document */}
        {latestComment &&
          (() => {
            const isRejection =
              latestComment.toStatus === 'DRAFT' &&
              latestComment.fromStatus === 'IN_REVIEW'
            const Icon = isRejection ? AlertTriangle : MessageSquare
            const timeAgo = formatTimeAgo(new Date(latestComment.createdAt))
            return (
              <div
                className={cn(
                  'mx-auto w-full max-w-[210mm] rounded-lg border px-4 py-3 mb-4',
                  isRejection
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50 border-blue-200'
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={cn(
                      'h-5 w-5 mt-0.5 shrink-0',
                      isRejection ? 'text-amber-600' : 'text-blue-600'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isRejection ? 'text-amber-900' : 'text-blue-900'
                        )}
                      >
                        {isRejection ? 'Nekad' : 'Kommentar'} av{' '}
                        {latestComment.userName}
                      </span>
                      <span
                        className={cn(
                          'text-xs shrink-0',
                          isRejection ? 'text-amber-600' : 'text-blue-600'
                        )}
                      >
                        {timeAgo}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'text-sm mt-1',
                        isRejection ? 'text-amber-800' : 'text-blue-800'
                      )}
                    >
                      {latestComment.comment}
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}

        <div className="mx-auto w-full max-w-[210mm] bg-background shadow-md rounded-sm px-16 py-12 min-h-[297mm]">
          {/* Inline title */}
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              titleRef.current = e.target.value
            }}
            readOnly={!editable}
            placeholder="Dokumenttitel"
            className="w-full text-3xl font-bold border-none outline-none bg-transparent mb-6 placeholder:text-muted-foreground/50"
          />
          {/* Tiptap editor content */}
          <EditorContent
            editor={editor}
            className={cn(
              'prose prose-sm max-w-none focus:outline-none',
              '[&_.tiptap]:outline-none [&_.tiptap]:min-h-[200px]',
              // Headings
              '[&_.tiptap_h1]:text-2xl [&_.tiptap_h1]:font-bold [&_.tiptap_h1]:mt-8 [&_.tiptap_h1]:mb-3 [&_.tiptap_h1]:border-b [&_.tiptap_h1]:border-border [&_.tiptap_h1]:pb-2',
              '[&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:mt-6 [&_.tiptap_h2]:mb-2',
              '[&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:mt-4 [&_.tiptap_h3]:mb-1',
              // Paragraphs
              '[&_.tiptap_p]:my-2 [&_.tiptap_p]:leading-relaxed',
              // Tables
              '[&_.tiptap_table]:border-collapse [&_.tiptap_table]:w-full [&_.tiptap_table]:my-4 [&_.tiptap_table]:text-sm',
              '[&_.tiptap_th]:border [&_.tiptap_th]:border-border [&_.tiptap_th]:bg-muted [&_.tiptap_th]:px-3 [&_.tiptap_th]:py-2 [&_.tiptap_th]:text-left [&_.tiptap_th]:font-semibold',
              '[&_.tiptap_td]:border [&_.tiptap_td]:border-border [&_.tiptap_td]:px-3 [&_.tiptap_td]:py-2 [&_.tiptap_td]:align-top',
              // Lists
              '[&_.tiptap_ul]:my-2 [&_.tiptap_ul]:pl-6 [&_.tiptap_ol]:my-2 [&_.tiptap_ol]:pl-6',
              // Horizontal rules
              '[&_.tiptap_hr]:my-6 [&_.tiptap_hr]:border-border'
            )}
          />
        </div>
      </div>

      {/* Diff view dialog */}
      <VersionDiffView
        documentId={documentId}
        open={diffOpen}
        onOpenChange={setDiffOpen}
        initialFromVersionId={diffFromId}
        initialToVersionId={diffToId}
      />
    </div>
  )
}
