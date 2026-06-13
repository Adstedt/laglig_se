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
import { trackEvent } from '@/lib/track-event'
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
import {
  createDraftFromApproved,
  discardDraft,
  promoteDraftToApproved,
  rejectDraftReview,
  submitDraftForReview,
} from '@/app/actions/documents'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { GitBranch, Trash2, CheckCircle2, Send, Undo2 } from 'lucide-react'
import { format as formatDate } from 'date-fns'
import { sv } from 'date-fns/locale'
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
  // Story 17.17 — dual-pointer model props. The page route derives these
  // from Story 17.16's `getDocument` extension and passes them through so the
  // editor can render the composite header indicator, route the action
  // buttons (Förkasta utkast / Godkänn utkast / Skicka för granskning), and
  // gate the read-only banner against the new pointer model rather than the
  // top-level status alone.
  currentDraftVersionId?: string | null
  currentApprovedVersionId?: string | null
  draftStatus?: 'DRAFT' | 'IN_REVIEW' | null
  approvedMetadata?: {
    versionNumber: number
    approverName: string | null
    approvedAt: string
  } | null
  viewMode?: 'approved' | 'default'
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
  currentDraftVersionId = null,
  currentApprovedVersionId = null,
  draftStatus = null,
  approvedMetadata = null,
  viewMode = 'default',
}: DocumentEditorProps) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [currentVersionNumber, setCurrentVersionNumber] =
    useState(versionNumber)
  const [currentStatus, setCurrentStatus] = useState(status)
  const [currentDraftStatus, setCurrentDraftStatus] = useState<
    'DRAFT' | 'IN_REVIEW' | null
  >(draftStatus)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(
    currentDraftVersionId
  )
  const titleRef = useRef(initialTitle)
  // DOM ref for the title textarea — auto-grows so long titles wrap (not clip).
  const titleInputRef = useRef<HTMLTextAreaElement>(null)
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffFromId, setDiffFromId] = useState<string | undefined>()
  const [diffToId, setDiffToId] = useState<string | undefined>()
  const [creatingDraft, setCreatingDraft] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  // Story 17.17 Task 5 v1.2 — pointer-aware `editable` gate (PO ratified).
  // Read-only iff:
  //   (a) viewMode === 'approved' (the ?view=approved deep-link forces the
  //       read-only approved view regardless of draft state), OR
  //   (b) the draft sub-status is IN_REVIEW (preserves today's "review is
  //       frozen for the reviewer" invariant under Model B), OR
  //   (c) there's no draft pointer AND the top-level status isn't an
  //       editable one (stable APPROVED / SUPERSEDED / ARCHIVED).
  //
  // Editable when there's a draft to edit (currentDraftId != null + sub-
  // status DRAFT) — that's the dual-state edit case AC 8 covers — OR when
  // the never-approved DRAFT fallback applies.
  const isDualState = currentDraftId != null && currentApprovedVersionId != null
  const editable =
    viewMode !== 'approved' &&
    currentDraftStatus !== 'IN_REVIEW' &&
    (currentDraftId != null ||
      (currentStatus === 'DRAFT' && currentApprovedVersionId == null))

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
    editorProps: {
      // Chrome's spellchecker flags correct Swedish words (wrong dictionary);
      // disable it to remove the red-squiggle noise on legal content.
      attributes: { spellcheck: 'false' },
      // Stop keystrokes from bubbling to global window shortcuts (e.g. "/"
      // opening the AI chat sidebar). Plain typing — no modifier — belongs
      // solely to the editor. Cmd/Ctrl-combos (save, toggle chat, etc.) are
      // allowed through so global shortcuts remain usable from within.
      handleDOMEvents: {
        keydown: (_view, event) => {
          if (!event.metaKey && !event.ctrlKey && !event.altKey) {
            event.stopPropagation()
          }
          return false
        },
      },
    },
  })

  // Sync editable state when status changes (e.g. APPROVED → DRAFT via "new version")
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // Re-seed Tiptap when the loaded version changes server-side (e.g. discardDraft
  // → router.refresh() switches the page from draft v2 → approved v1). `useEditor`
  // only consumes `content` at mount, so without this the editor keeps the
  // discarded draft's body until a hard page reload. Watch versionNumber +
  // viewMode (the two server-rendered identifiers for what's loaded) and reset
  // content + title together. `emitUpdate: false` prevents the reset from
  // looking like a user edit and re-triggering autosave.
  const lastLoadedVersionRef = useRef<string>(`${versionNumber}|${viewMode}`)
  useEffect(() => {
    if (!editor) return
    const next = `${versionNumber}|${viewMode}`
    if (lastLoadedVersionRef.current === next) return
    editor.commands.setContent(initialContent, { emitUpdate: false })
    titleRef.current = initialTitle
    setTitle(initialTitle)
    setCurrentVersionNumber(versionNumber)
    lastLoadedVersionRef.current = next
  }, [editor, versionNumber, viewMode, initialContent, initialTitle])

  // Auto-grow the title textarea so a long title wraps to multiple lines
  // instead of clipping at the page edge (single-line <input> behaviour).
  useEffect(() => {
    const el = titleInputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

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
      // Story 17.17 smoke fix — Model B-correct optimistic state seed.
      //
      // Under Story 17.16, createDraftFromApproved does NOT flip the top-
      // level status (it stays APPROVED throughout the draft window) and
      // only populates the draft pointer. The legacy `setCurrentStatus(
      // 'DRAFT')` left the UI in a half-broken intermediate state (Utkast
      // badge but no dual-state banner / AC 6 indicator / Skicka button)
      // until a manual page refresh kicked the server-prop chain.
      //
      // The correct optimistic update is: leave top-level status, seed the
      // new draft pointer + sub-status, bump the version counter to the
      // freshly-created draft's number. router.refresh() then back-fills
      // any remaining prop-derived state (approvedMetadata, etc.) on the
      // next render.
      setCurrentDraftId(result.data.id)
      setCurrentDraftStatus('DRAFT')
      setCurrentVersionNumber(result.data.versionNumber)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Kunde inte skapa ny version')
    }
  }, [documentId, router])

  // Story 17.17 AC 7 / AC 8 — dual-state action handlers wired to Story
  // 17.16's server actions. Each one toasts on failure and refreshes the
  // server-rendered tree on success so the new pointer state propagates.
  const handleDiscardDraft = useCallback(async () => {
    setDiscarding(true)
    const result = await discardDraft(documentId)
    setDiscarding(false)
    setShowDiscardDialog(false)
    if (result.success) {
      setCurrentDraftId(null)
      setCurrentDraftStatus(null)
      toast.success('Utkastet förkastades. Den godkända versionen är gällande.')
      router.refresh()
    } else {
      toast.error(result.error ?? 'Kunde inte förkasta utkastet')
    }
  }, [documentId, router])

  const handleSubmitForReview = useCallback(async () => {
    setSubmitting(true)
    const result = await submitDraftForReview(documentId)
    setSubmitting(false)
    if (result.success) {
      setCurrentDraftStatus('IN_REVIEW')
      toast.success('Utkastet skickades för granskning.')
      router.refresh()
    } else {
      toast.error(result.error ?? 'Kunde inte skicka utkastet för granskning')
    }
  }, [documentId, router])

  const handlePromoteDraft = useCallback(async () => {
    setPromoting(true)
    const result = await promoteDraftToApproved(documentId)
    setPromoting(false)
    if (result.success) {
      trackEvent('document_approved', { documentId })
      setCurrentStatus('APPROVED')
      setCurrentDraftId(null)
      setCurrentDraftStatus(null)
      toast.success('Utkastet godkändes.')
      router.refresh()
    } else {
      toast.error(result.error ?? 'Kunde inte godkänna utkastet')
    }
  }, [documentId, router])

  const handleRejectReview = useCallback(async () => {
    setRejecting(true)
    const result = await rejectDraftReview(documentId)
    setRejecting(false)
    if (result.success) {
      setCurrentDraftStatus('DRAFT')
      toast.success('Utkastet skickades tillbaka till författaren.')
      router.refresh()
    } else {
      toast.error(result.error ?? 'Kunde inte neka utkastet')
    }
  }, [documentId, router])

  // Story 17.17 AC 6 — derived approved version number for the dual-state
  // secondary metadata indicator. Null when the doc has no approved version
  // (never-approved drafts).
  const approvedDisplayDate = approvedMetadata
    ? formatDate(new Date(approvedMetadata.approvedAt), 'd MMMM yyyy', {
        locale: sv,
      })
    : null

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
      {/* Read-only banner — Story 17.17 Task 5 v1.2 (PO ratified): pointer-
          aware gating. The dual-state-read-only branch (viewMode='approved'
          on a dual-state doc) uses the FROZEN Swedish copy locked in v1.3:
          "Du visar Godkänd v{N} i läsläge. Ett utkast pågår." */}
      {!editable && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
          {viewMode === 'approved' &&
            isDualState &&
            approvedMetadata &&
            `Du visar Godkänd v${approvedMetadata.versionNumber} i läsläge. Ett utkast pågår.`}
          {viewMode === 'approved' &&
            !isDualState &&
            'Du visar den godkända versionen i läsläge.'}
          {viewMode !== 'approved' &&
            currentDraftStatus === 'IN_REVIEW' &&
            'Detta utkast är skickat för granskning och kan inte redigeras.'}
          {viewMode !== 'approved' &&
            currentDraftStatus !== 'IN_REVIEW' &&
            currentStatus === 'IN_REVIEW' &&
            'Detta dokument är under granskning och kan inte redigeras.'}
          {viewMode !== 'approved' &&
            currentDraftStatus !== 'IN_REVIEW' &&
            currentStatus === 'APPROVED' &&
            !isDualState &&
            'Detta dokument är godkänt och kan inte redigeras.'}
          {viewMode !== 'approved' &&
            currentStatus === 'SUPERSEDED' &&
            'Detta dokument har ersatts av en nyare version.'}
          {viewMode !== 'approved' &&
            currentStatus === 'ARCHIVED' &&
            'Detta dokument är arkiverat.'}
        </div>
      )}

      {/* Story 17.17 AC 8 — dual-state edit banner. FROZEN copy per v1.1.
          Renders only when the editor is showing a draft that replaces an
          approved version (the dual-state edit case). Includes the
          "Förkasta utkast" action with required AlertDialog confirmation. */}
      {editable && isDualState && approvedMetadata && currentDraftId && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <GitBranch className="h-4 w-4 shrink-0" />
            <span>
              {`Du redigerar Utkast v${currentVersionNumber} som ersätter Godkänd v${approvedMetadata.versionNumber} efter godkännande.`}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-amber-800 hover:text-destructive"
            onClick={() => setShowDiscardDialog(true)}
            disabled={discarding}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Förkasta utkast
          </Button>
        </div>
      )}

      {/* Metadata bar */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/workspace/styrdokument')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Tillbaka
          </Button>
          {/* Story 17.17 smoke-found polish: in dual-state contexts the
              metadata pill reflects the ACTIVE context (the draft being
              edited / under review) rather than the doc's top-level status
              (which under Model B stays APPROVED throughout the draft
              window). The AC 6 secondary indicator below carries the
              approved baseline info; the small pill now matches what the
              user is actually doing in the editor.
              - viewMode='approved' → top-level status (Godkänd — correct, you're viewing approved)
              - dual-state edit/review → draft sub-status (Utkast / Under granskning)
              - single-state → top-level status (today's behavior) */}
          <DocumentStatusBadge
            status={
              isDualState && viewMode !== 'approved' && currentDraftStatus
                ? currentDraftStatus
                : currentStatus
            }
          />
          <span className="text-xs text-muted-foreground/60">
            v{currentVersionNumber} &middot; {authorName}
          </span>
          {/* Story 17.17 AC 6 — secondary "Godkänd v{N} av {name} den {date}"
              indicator for the dual-state header. Reads `approvedMetadata`
              (doc-level approved_by/approved_at + current_approved_version_id
              joined approver name) so the approved metadata stays visible
              throughout the revision window. */}
          {isDualState && approvedMetadata && approvedDisplayDate && (
            <span className="text-xs text-muted-foreground/60">
              {`· Godkänd v${approvedMetadata.versionNumber}${
                approvedMetadata.approverName
                  ? ` av ${approvedMetadata.approverName}`
                  : ''
              } den ${approvedDisplayDate}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Story 17.17 smoke-found polish: word count + save status group
              as ONE metadata cluster with tight internal spacing + matching
              text size, separated from the action buttons by the parent's
              gap-3. Middot mirrors the AC 6 secondary-indicator pattern on
              the left so the two info clusters visually rhyme. */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            {editor && (
              <span>{editor.storage.characterCount?.words() ?? 0} ord</span>
            )}
            {editor && (
              <span aria-hidden="true" className="text-muted-foreground/40">
                ·
              </span>
            )}
            <span
              className={cn(
                saveStatus === 'unsaved' && 'text-amber-600',
                saveStatus === 'error' && 'text-destructive'
              )}
            >
              {saveStatusText}
            </span>
          </div>
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
            // Story 17.17 smoke-found polish: panel's "Aktuell" tag marks the
            // canonical approved baseline ("i kraft"), NOT whichever version
            // the editor is currently displaying. For a dual-state edit on a
            // doc with approved v8 + draft v9: Aktuell = v8, even though the
            // editor metadata bar shows "v9" (what's being edited).
            currentVersionNumber={
              approvedMetadata?.versionNumber ?? currentVersionNumber
            }
            onRestore={handleVersionRestore}
            onCompare={handleCompare}
            documentStatus={currentStatus}
            currentDraftVersionId={currentDraftId}
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
          {/* Story 17.17 AC 7 — dual-state primary forward actions ("Skicka
              för granskning" / "Godkänn utkast"). Placed here on the right
              action bar where the legacy "Skapa ny version" primary used to
              live (now suppressed by StatusTransitionControls when a draft
              pointer is set) so the muscle-memory pattern is preserved. */}
          {currentDraftId &&
            currentDraftStatus === 'DRAFT' &&
            viewMode !== 'approved' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSubmitForReview}
                disabled={submitting}
              >
                <Send className="mr-1 h-4 w-4" />
                Skicka för granskning
              </Button>
            )}
          {currentDraftId &&
            currentDraftStatus === 'IN_REVIEW' &&
            viewMode !== 'approved' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRejectReview}
                  disabled={rejecting}
                >
                  <Undo2 className="mr-1 h-4 w-4" />
                  Neka
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handlePromoteDraft}
                  disabled={promoting}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  Godkänn utkast
                </Button>
              </>
            )}
          <StatusTransitionControls
            documentId={documentId}
            currentStatus={currentStatus}
            onStatusChange={handleStatusChange}
            onCreateDraft={handleCreateDraft}
            creatingDraft={creatingDraft}
            currentDraftVersionId={currentDraftId}
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
          {/* Inline title — textarea so long titles wrap instead of clipping */}
          <textarea
            ref={titleInputRef}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              titleRef.current = e.target.value
            }}
            readOnly={!editable}
            placeholder="Dokumenttitel"
            rows={1}
            // pt-1: the textarea clips overflow (for auto-grow), and `leading-tight`
            // leaves too little half-leading above line 1 — without top padding the
            // umlaut on tall glyphs (Å/Ä/Ö) on the first line gets clipped.
            className="w-full resize-none overflow-hidden text-3xl font-bold leading-tight border-none outline-none bg-transparent pt-1 mb-6 placeholder:text-muted-foreground/50"
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
              // 19.8 QA: agent-authored tables can have 7+ columns (templates max
              // at 5). A styrdokument is printed/exported to A4 — horizontal
              // scroll is not an option there. `table-fixed` + w-full forces the
              // table to the page width and wraps cell text so it ALWAYS fits the
              // sheet (matches the docx/pdf export fix).
              '[&_.tiptap_table]:table-fixed [&_.tiptap_table]:border-collapse [&_.tiptap_table]:w-full [&_.tiptap_table]:my-4 [&_.tiptap_table]:text-sm',
              '[&_.tiptap_th]:border [&_.tiptap_th]:border-border [&_.tiptap_th]:bg-muted [&_.tiptap_th]:px-3 [&_.tiptap_th]:py-2 [&_.tiptap_th]:text-left [&_.tiptap_th]:font-semibold [&_.tiptap_th]:break-words',
              '[&_.tiptap_td]:border [&_.tiptap_td]:border-border [&_.tiptap_td]:px-3 [&_.tiptap_td]:py-2 [&_.tiptap_td]:align-top [&_.tiptap_td]:break-words',
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

      {/* Story 17.17 AC 8 — required confirmation dialog before discarding
          a draft. Approved version stays effective; the draft version row
          remains in version history (just stops being pointed at). */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Förkasta utkastet?</AlertDialogTitle>
            <AlertDialogDescription>
              {approvedMetadata
                ? `Vill ni förkasta utkast v${currentVersionNumber}? Den godkända versionen v${approvedMetadata.versionNumber} förblir gällande.`
                : 'Vill ni förkasta utkastet?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discarding}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardDraft}
              disabled={discarding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Förkasta utkast
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
