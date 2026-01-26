'use client'

/**
 * Story 6.7a & 6.7b: File Preview Panel
 * Slide-in panel showing file details with edit/delete capabilities
 * Enhanced with rich previews for images, PDFs, and Office documents
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Download,
  Trash2,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  X,
  Pencil,
  Save,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getFileIcon, formatFileSize } from './file-dropzone'
import { categoryLabels, categoryColors } from './file-card'
import { ImagePreview } from './preview/image-preview'
import { PdfPreview } from './preview/pdf-preview'
import { OfficePreview, OfficeFallback } from './preview/office-preview'
import { FileLightbox } from './preview/lightbox'
import { MetadataPanel } from './preview/metadata-panel'
import {
  updateFile,
  deleteFile,
  getFileDownloadUrl,
  unlinkFile,
} from '@/app/actions/files'
import type { WorkspaceFileWithLinks } from '@/app/actions/files'
import type { FileCategory } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

interface FilePreviewPanelProps {
  file: WorkspaceFileWithLinks | null
  open: boolean
  onOpenChange: (_open: boolean) => void
  onUpdate?: () => void
  onDelete?: () => void
  onLinkClick?: (_file: WorkspaceFileWithLinks) => void
}

// ============================================================================
// Helpers
// ============================================================================

function isImageFile(mimeType: string | null | undefined): boolean {
  return mimeType?.startsWith('image/') ?? false
}

function isPdfFile(mimeType: string | null | undefined): boolean {
  return mimeType === 'application/pdf'
}

function isOfficeFile(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false
  return (
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('presentation') ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.ms-powerpoint'
  )
}

// ============================================================================
// Component
// ============================================================================

export function FilePreviewPanel({
  file,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  onLinkClick,
}: FilePreviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedCategory, setEditedCategory] = useState<FileCategory>('OVRIGT')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  const [pdfPageCount, setPdfPageCount] = useState<number | undefined>(
    undefined
  )

  // Load expanded state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('filePreviewExpanded')
    if (stored === 'true') {
      setIsExpanded(true)
    }
  }, [])

  // Persist expanded state
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const newValue = !prev
      localStorage.setItem('filePreviewExpanded', String(newValue))
      return newValue
    })
  }, [])

  // Load file URL when file changes
  useEffect(() => {
    if (!file || !open) {
      setFileUrl(null)
      setImageDimensions(null)
      setPdfPageCount(undefined)
      return
    }

    // Only load URL for previewable files
    if (
      isImageFile(file.mime_type) ||
      isPdfFile(file.mime_type) ||
      isOfficeFile(file.mime_type)
    ) {
      setIsLoadingUrl(true)
      getFileDownloadUrl(file.id)
        .then((result) => {
          if (result.success && result.data?.url) {
            setFileUrl(result.data.url)
          } else {
            setFileUrl(null)
          }
        })
        .catch(() => setFileUrl(null))
        .finally(() => setIsLoadingUrl(false))
    }
  }, [file, open])

  // Extract image dimensions when URL loads
  useEffect(() => {
    if (!fileUrl || !file || !isImageFile(file.mime_type)) {
      setImageDimensions(null)
      return
    }

    const img = new Image()
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.src = fileUrl
  }, [fileUrl, file])

  // Reset edit state when file changes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsEditing(false)
    }
    onOpenChange(newOpen)
  }

  const startEditing = () => {
    if (file) {
      setEditedName(file.filename)
      setEditedCategory(file.category)
      setIsEditing(true)
    }
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditedName('')
  }

  const handleSave = async () => {
    if (!file) return

    setIsSaving(true)
    try {
      const result = await updateFile(file.id, {
        filename: editedName,
        category: editedCategory,
      })

      if (result.success) {
        toast.success('Filen har uppdaterats')
        setIsEditing(false)
        onUpdate?.()
      } else {
        toast.error(result.error || 'Kunde inte uppdatera filen')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Ett fel uppstod')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!file) return

    setIsDeleting(true)
    try {
      const result = await deleteFile(file.id)

      if (result.success) {
        toast.success('Filen har raderats')
        onOpenChange(false)
        onDelete?.()
      } else {
        toast.error(result.error || 'Kunde inte radera filen')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Ett fel uppstod')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDownload = async () => {
    if (!file) return

    setIsDownloading(true)
    try {
      const result = await getFileDownloadUrl(file.id)

      if (result.success && result.data?.url) {
        window.open(result.data.url, '_blank')
      } else {
        toast.error(result.error || 'Kunde inte hämta nedladdningslänk')
      }
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Ett fel uppstod')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleUnlink = async (
    entityType: 'task' | 'list_item',
    entityId: string
  ) => {
    if (!file) return

    try {
      const result = await unlinkFile(file.id, entityType, entityId)

      if (result.success) {
        toast.success('Länken har tagits bort')
        onUpdate?.()
      } else {
        toast.error(result.error || 'Kunde inte ta bort länken')
      }
    } catch (error) {
      console.error('Unlink error:', error)
      toast.error('Ett fel uppstod')
    }
  }

  if (!file) return null

  const isImage = isImageFile(file.mime_type)
  const isPdf = isPdfFile(file.mime_type)
  const isOffice = isOfficeFile(file.mime_type)

  const formattedDate = new Date(file.created_at).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Panel width: 640px default, 50vw when expanded
  // Must override sm:max-w-sm from sheetVariants with !max-w-none or specific max-width
  const panelWidth = isExpanded
    ? 'w-[50vw] max-w-[50vw]'
    : 'w-[640px] max-w-[640px]'

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          className={cn(
            'overflow-y-auto transition-all duration-200 sm:max-w-none',
            panelWidth
          )}
        >
          {/* Expand button - matches close button styling exactly */}
          <button
            type="button"
            onClick={toggleExpanded}
            className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            title={isExpanded ? 'Minimera' : 'Expandera'}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          <SheetHeader className="space-y-1">
            <SheetTitle className="pr-16 truncate">
              {isEditing ? 'Redigera fil' : file.filename}
            </SheetTitle>
            <SheetDescription>
              {formatFileSize(file.file_size)} - Uppladdad {formattedDate}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Rich Preview Section */}
            <div className="bg-muted/30 rounded-lg overflow-hidden">
              {isLoadingUrl ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : isImage && fileUrl ? (
                <ImagePreview
                  url={fileUrl}
                  alt={file.filename}
                  onFullscreen={() => setLightboxOpen(true)}
                  className="min-h-[300px]"
                />
              ) : isPdf && fileUrl ? (
                <PdfPreview
                  url={fileUrl}
                  filename={file.filename}
                  onOpenInNewTab={handleDownload}
                  className="min-h-[400px]"
                />
              ) : isOffice && fileUrl ? (
                <OfficePreview
                  url={fileUrl}
                  filename={file.filename}
                  mimeType={file.mime_type || ''}
                  onDownload={handleDownload}
                  className="min-h-[400px]"
                />
              ) : isOffice ? (
                <OfficeFallback
                  mimeType={file.mime_type || ''}
                  onDownload={handleDownload}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-2">
                  {getFileIcon(file.mime_type, 'h-16 w-16')}
                  <p className="text-sm text-muted-foreground">
                    Förhandsgranskning ej tillgänglig
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Öppna fil
                  </Button>
                </div>
              )}
            </div>

            {/* Metadata Panel */}
            <MetadataPanel
              file={{
                filename: file.filename,
                original_filename: file.original_filename,
                file_size: file.file_size,
                mime_type: file.mime_type,
                created_at: file.created_at,
                updated_at: file.updated_at,
              }}
              imageUrl={isImage ? (fileUrl ?? undefined) : undefined}
              pdfPageCount={pdfPageCount}
              imageDimensions={imageDimensions ?? undefined}
            />

            <Separator />

            {/* Edit Form or Details */}
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="filename">Filnamn</Label>
                  <Input
                    id="filename"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Ange filnamn"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Kategori</Label>
                  <Select
                    value={editedCategory}
                    onValueChange={(value) =>
                      setEditedCategory(value as FileCategory)
                    }
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(categoryLabels) as FileCategory[]).map(
                        (cat) => (
                          <SelectItem key={cat} value={cat}>
                            {categoryLabels[cat]}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !editedName.trim()}
                  >
                    {isSaving && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    <Save className="h-4 w-4 mr-2" />
                    Spara
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    Avbryt
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* File Details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Kategori
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', categoryColors[file.category])}
                    >
                      {categoryLabels[file.category]}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Uppladdad av
                    </span>
                    <span className="text-sm">
                      {file.uploader.name || file.uploader.email}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Linked Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Länkade objekt</h4>
                    {onLinkClick && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onLinkClick(file)}
                      >
                        <LinkIcon className="h-4 w-4 mr-1" />
                        Länka till
                      </Button>
                    )}
                  </div>

                  {file.task_links.length === 0 &&
                  file.list_item_links.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Filen är inte länkad till några uppgifter eller lagar.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {file.task_links.map((link) => (
                        <div
                          key={link.id}
                          className="flex items-center justify-between text-sm bg-muted/50 rounded-md p-2"
                        >
                          <span className="truncate">{link.task.title}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleUnlink('task', link.task.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {file.list_item_links.map((link) => (
                        <div
                          key={link.id}
                          className="flex items-center justify-between text-sm bg-muted/50 rounded-md p-2"
                        >
                          <span className="truncate">
                            {link.list_item.document.title}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              handleUnlink('list_item', link.list_item.id)
                            }
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={startEditing}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Redigera
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Ladda ner
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Radera
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Radera fil?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Är du säker på att du vill radera &quot;
                          {file.filename}
                          &quot;? Denna åtgärd kan inte ångras och filen kommer
                          tas bort från alla länkade uppgifter och lagar.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleting && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          Radera
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Full-screen lightbox for images */}
      {isImage && fileUrl && (
        <FileLightbox
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          slides={[{ src: fileUrl, title: file.filename }]}
        />
      )}
    </>
  )
}
