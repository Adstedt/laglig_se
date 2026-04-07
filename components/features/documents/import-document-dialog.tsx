'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertTriangle,
  FileUp,
  Loader2,
  Upload,
  CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { importDocxDocument } from '@/app/actions/documents'

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  POLICY: 'Policy',
  RISK_ASSESSMENT: 'Riskbedömning',
  ACTION_PLAN: 'Handlingsplan',
  PROCEDURE: 'Rutin',
  INSTRUCTION: 'Instruktion',
  CHECKLIST: 'Checklista',
  REPORT: 'Rapport',
  OTHER: 'Övrigt',
}

interface ImportDocumentDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
}

interface FileEntry {
  file: File
  title: string
  documentType: string
  documentNumber: string
}

export function ImportDocumentDialog({
  open,
  onOpenChange,
}: ImportDocumentDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<
    Array<{ title: string; id?: string; error?: string }>
  >([])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files ?? [])
      const valid: FileEntry[] = []

      for (const file of selectedFiles) {
        if (file.type !== DOCX_MIME) {
          toast.error(`${file.name}: Ogiltig filtyp — endast .docx stöds`)
          continue
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name}: Filen är för stor (max 25 MB)`)
          continue
        }
        valid.push({
          file,
          title: file.name.replace(/\.docx$/i, ''),
          documentType: 'OTHER',
          documentNumber: '',
        })
      }

      setFiles(valid)
      setResults([])
    },
    []
  )

  const updateFile = useCallback(
    (index: number, updates: Partial<FileEntry>) => {
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
      )
    },
    []
  )

  const handleImport = useCallback(async () => {
    if (files.length === 0) return

    setImporting(true)
    setProgress({ current: 0, total: files.length })
    const importResults: Array<{
      title: string
      id?: string
      error?: string
    }> = []

    for (let i = 0; i < files.length; i++) {
      const entry = files[i]!
      setProgress({ current: i + 1, total: files.length })

      const formData = new FormData()
      formData.append('file', entry.file)
      formData.append('title', entry.title)
      formData.append('documentType', entry.documentType)
      if (entry.documentNumber) {
        formData.append('documentNumber', entry.documentNumber)
      }

      const result = await importDocxDocument(formData)

      if (result.success && result.data) {
        importResults.push({ title: entry.title, id: result.data.id })
      } else {
        importResults.push({
          title: entry.title,
          error: result.error ?? 'Okänt fel',
        })
      }
    }

    setResults(importResults)
    setImporting(false)

    const successCount = importResults.filter((r) => r.id).length
    if (successCount > 0) {
      toast.success(`${successCount} dokument importerade`)
    }

    // Single file → navigate to editor; multiple → stay for summary
    if (files.length === 1 && importResults[0]?.id) {
      onOpenChange(false)
      router.push(`/workspace/styrdokument/${importResults[0].id}/edit`)
    }
  }, [files, onOpenChange, router])

  const handleClose = useCallback(() => {
    setFiles([])
    setResults([])
    setProgress({ current: 0, total: 0 })
    onOpenChange(false)
    // Refresh if any imports succeeded
    if (results.some((r) => r.id)) {
      router.refresh()
    }
  }, [onOpenChange, results, router])

  const hasResults = results.length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importera dokument</DialogTitle>
          <DialogDescription>
            Importera .docx-filer till Laglig. Varje fil blir ett separat
            dokument.
          </DialogDescription>
        </DialogHeader>

        {/* Warning banner */}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Komplex formatering som sidhuvud, sidfot, kolumner och makron kan gå
            förlorade vid import.
          </span>
        </div>

        {/* File input */}
        {!hasResults && (
          <>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <Upload className="mr-2 h-4 w-4" />
                Välj .docx-fil{files.length > 0 ? 'er' : ''}
              </Button>
            </div>

            {/* File entries */}
            {files.length > 0 && (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-4">
                  {files.map((entry, i) => (
                    <div key={i} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileUp className="h-4 w-4" />
                        {entry.file.name}
                      </div>
                      <div>
                        <Label className="text-xs">Titel</Label>
                        <Input
                          value={entry.title}
                          onChange={(e) =>
                            updateFile(i, { title: e.target.value })
                          }
                          disabled={importing}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Dokumenttyp</Label>
                          <Select
                            value={entry.documentType}
                            onValueChange={(v) =>
                              updateFile(i, { documentType: v })
                            }
                            disabled={importing}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(DOCUMENT_TYPE_LABELS).map(
                                ([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Dokumentnummer</Label>
                          <Input
                            value={entry.documentNumber}
                            onChange={(e) =>
                              updateFile(i, { documentNumber: e.target.value })
                            }
                            placeholder="Valfritt"
                            disabled={importing}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Progress */}
            {importing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Importerar fil {progress.current} av {progress.total}...
              </div>
            )}
          </>
        )}

        {/* Results summary */}
        {hasResults && (
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {r.id ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span>{r.title}</span>
                {r.error && (
                  <span className="text-xs text-red-600">— {r.error}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {hasResults ? (
            <Button onClick={handleClose}>Stäng</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={importing}
              >
                Avbryt
              </Button>
              <Button
                onClick={handleImport}
                disabled={files.length === 0 || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importerar...
                  </>
                ) : (
                  `Importera ${files.length > 0 ? `(${files.length})` : ''}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
