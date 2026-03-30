'use client'

import { useEditor, EditorContent } from '@tiptap/react'
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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TiptapContent = Record<string, any>
import { EditorToolbar } from './editor-toolbar'
import { SlashCommandExtension } from './slash-command'
import { useDocumentAutosave } from '@/lib/hooks/use-document-autosave'
import { saveDocumentVersion } from '@/app/actions/documents'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Save,
  FilePlus,
  FileText,
  FileDown,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { VersionHistoryPanel } from './version-history-panel'
import { VersionDiffView } from './version-diff-view'
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

interface DocumentEditorProps {
  documentId: string
  initialTitle: string
  initialContent: TiptapContent
  status: string
  versionNumber: number
  authorName: string
  documentNumber?: string | null | undefined
  reviewDate?: string | null | undefined
  retentionUntil?: string | null | undefined
  documentType?: string | undefined
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
  retentionUntil,
  documentType,
}: DocumentEditorProps) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [currentVersionNumber, setCurrentVersionNumber] =
    useState(versionNumber)
  const [currentStatus] = useState(status)
  const titleRef = useRef(initialTitle)
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffFromId, setDiffFromId] = useState<string | undefined>()
  const [diffToId, setDiffToId] = useState<string | undefined>()
  const [creatingDraft, setCreatingDraft] = useState(false)
  const [exporting, setExporting] = useState(false)
  const editable = isDocumentEditable(currentStatus)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
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
      SlashCommandExtension.configure({ documentId }),
    ],
    content: initialContent,
    editable,
    immediatelyRender: false,
  })

  const handleSave = useCallback(
    async (contentJson: object) => {
      const result = await saveDocumentVersion(
        documentId,
        contentJson,
        undefined,
        titleRef.current !== initialTitle ? titleRef.current : undefined
      )
      if (result.success && result.data) {
        setCurrentVersionNumber(result.data.versionNumber)
      }
      return result.success
    },
    [documentId, initialTitle]
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

  const handleStatusChange = useCallback(() => {
    router.refresh()
  }, [router])

  const handleCreateDraft = useCallback(async () => {
    setCreatingDraft(true)
    const result = await createDraftFromApproved(documentId)
    setCreatingDraft(false)
    if (result.success) {
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
        <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
          <span>
            Detta dokument är godkänt. Skapa en ny version för att göra
            ändringar.
          </span>
          {currentStatus === 'APPROVED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateDraft}
              disabled={creatingDraft}
            >
              <FilePlus className="mr-1 h-4 w-4" />
              {creatingDraft ? 'Skapar...' : 'Skapa ny version'}
            </Button>
          )}
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
          <StatusTransitionControls
            documentId={documentId}
            currentStatus={currentStatus}
            onStatusChange={handleStatusChange}
          />
          <span className="text-sm text-muted-foreground">
            v{currentVersionNumber}
          </span>
          <span className="text-sm text-muted-foreground">{authorName}</span>
        </div>
        <div className="flex items-center gap-3">
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
            initialRetentionUntil={retentionUntil ?? null}
            initialDocumentType={documentType ?? null}
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
        </div>
      </div>

      {/* Toolbar */}
      {editor && <EditorToolbar editor={editor} documentId={documentId} />}

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto bg-muted/30 py-8">
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
            className="prose prose-sm max-w-none focus:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[200px]"
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
