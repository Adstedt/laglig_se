'use client'

/**
 * Story 24.2: Import upload step.
 *
 * Used by:
 *   - Story 24.6's `/laglistor/skapa` Generate / Import path-choice fork
 *   - Story B.1 (Epic 25) first-run onboarding modal — import path
 *
 * Cross-epic directory note (per 24.2 SHOULD-002): the parent directory
 * `components/features/onboarding-modal/` is shared with Epic 25. Do not
 * delete sibling files; first-arriver creates the directory.
 *
 * The component is fully self-contained — provides Fil/Klistra-in tabs,
 * a hand-rolled HTML5 dropzone (no shadcn Dropzone primitive exists; ~30
 * lines of inline code per AC 11), template-download link, and a submit
 * handler that calls `createImport` → `parseImportFile` and then routes
 * to the granska review surface (built in Story 24.4).
 */

import {
  useState,
  useRef,
  useCallback,
  type DragEvent,
  type ChangeEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CloudUpload, FileSpreadsheet, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  createImport,
  parseImportFile,
  runMatching,
} from '@/app/actions/law-list-import'

type SourceType = 'xlsx' | 'csv' | 'paste'
type Mode = 'fil' | 'paste'
/**
 * Submit-button phase. Drives the staged copy + spinner during the
 * upload → parse → match pipeline. `matching` is the slow phase (5–30s
 * with LLM disambiguation) so we surface it as its own visible step.
 */
type SubmitPhase = 'idle' | 'uploading' | 'matching'

const ACCEPTED_EXTENSIONS = '.xlsx,.xls,.csv'
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

interface ImportUploadStepProps {
  /**
   * Optional override for post-success routing. Defaults to
   * `/laglistor/skapa/${importId}/granska` (Story 24.4 builds this page).
   * Story 24.6 may pass a different path; Epic 25 B.1 keeps the default.
   */
  onSuccess?: (_importId: string) => void
}

export function ImportUploadStep({ onSuccess }: ImportUploadStepProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('fil')
  const [file, setFile] = useState<File | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const isSubmitting = phase !== 'idle'
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleDrag = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      handleDrag(e)
      setIsDragging(true)
    },
    [handleDrag]
  )

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      handleDrag(e)
      setIsDragging(false)
    },
    [handleDrag]
  )

  const acceptFile = useCallback((picked: File) => {
    if (picked.size > MAX_FILE_SIZE_BYTES) {
      toast.error('Filen är för stor', {
        description: 'Max 5 MB. Försök med en mindre fil.',
      })
      return
    }
    setFile(picked)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      handleDrag(e)
      setIsDragging(false)
      const dropped = e.dataTransfer.files?.[0]
      if (dropped) acceptFile(dropped)
    },
    [acceptFile, handleDrag]
  )

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0]
      if (picked) acceptFile(picked)
    },
    [acceptFile]
  )

  const detectSourceType = (filename: string): SourceType => {
    const lower = filename.toLowerCase()
    if (lower.endsWith('.csv')) return 'csv'
    return 'xlsx' // .xlsx and .xls both go through xlsx parser
  }

  async function readFileAsBase64(blob: File): Promise<string> {
    const buffer = await blob.arrayBuffer()
    // Browser-safe base64 of a binary blob.
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + chunk, bytes.length))
      )
    }
    return btoa(binary)
  }

  function pasteToBase64(text: string): string {
    // Story 24.2 QA gate CODE-001: replaces the deprecated
    // `btoa(unescape(encodeURIComponent(text)))` idiom with the modern
    // TextEncoder pattern that mirrors `readFileAsBase64` above. Same
    // round-trip semantics — server decodes via `Buffer.from(b64, 'base64')
    // .toString('utf8')` and gets the original UTF-8 string back.
    const bytes = new TextEncoder().encode(text)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + chunk, bytes.length))
      )
    }
    return btoa(binary)
  }

  async function handleSubmit() {
    if (isSubmitting) return

    if (mode === 'fil') {
      if (!file) {
        toast.error('Välj en fil först')
        return
      }
    } else {
      if (pasteText.trim().length === 0) {
        toast.error('Klistra in minst en rad först')
        return
      }
    }

    setPhase('uploading')
    try {
      const filename =
        mode === 'fil' ? (file?.name ?? 'import.xlsx') : 'paste-input.txt'
      const sourceType: SourceType =
        mode === 'fil' && file ? detectSourceType(file.name) : 'paste'

      const created = await createImport({
        filename,
        source_type: sourceType,
      })
      if (!created.success || !created.data) {
        toast.error('Kunde inte starta importen', {
          description: created.error,
        })
        return
      }

      const fileBuffer =
        mode === 'fil' && file
          ? await readFileAsBase64(file)
          : pasteToBase64(pasteText)

      const parsed = await parseImportFile({
        importId: created.data.importId,
        fileBuffer,
      })
      if (!parsed.success || !parsed.data) {
        toast.error('Kunde inte tolka filen', { description: parsed.error })
        return
      }

      if (parsed.data.truncated) {
        toast.warning(
          'Vi importerade de första 1000 raderna. Kontakta oss om du behöver importera fler.'
        )
      }

      // Kick off matching. The granska page (Story 24.4) redirects when
      // status is still UPLOADED, so we must advance to MATCHING/AWAITING_REVIEW
      // before navigating. The action runs the full 3-branch matcher + LLM
      // disambiguation server-side (5–30s with LLM); flip phase so the button
      // surfaces "Matchar mot katalogen…" instead of the parse-phase copy.
      setPhase('matching')
      const matched = await runMatching(created.data.importId)
      if (!matched.success) {
        toast.error('Kunde inte matcha raderna mot katalogen', {
          description: matched.error,
        })
        return
      }

      if (onSuccess) {
        onSuccess(created.data.importId)
      } else {
        router.push(`/laglistor/skapa/${created.data.importId}/granska`)
      }
    } finally {
      setPhase('idle')
    }
  }

  const submitLabel =
    phase === 'matching'
      ? 'Matchar mot katalogen…'
      : phase === 'uploading'
        ? 'Importerar…'
        : 'Importera'

  const submitDisabled =
    isSubmitting ||
    (mode === 'fil' ? file === null : pasteText.trim().length === 0)

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Ladda upp er befintliga lista
        </h2>
        <p className="text-muted-foreground">
          Vi läser in raderna och försöker matcha dem mot vår katalog. Du får
          granska resultatet innan listan blir aktiv.
        </p>
      </header>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as Mode)}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="fil">Fil</TabsTrigger>
          <TabsTrigger value="paste">Klistra in</TabsTrigger>
        </TabsList>

        <TabsContent value="fil" className="space-y-4">
          {/* Hand-rolled HTML5 dropzone — no shadcn Dropzone primitive in this repo. */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDrag}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors',
              'hover:border-primary/50 hover:bg-muted/50',
              isDragging && 'border-primary bg-primary/5',
              file && 'border-green-500/50 bg-green-50/50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={handleFileInputChange}
            />
            {file ? (
              <>
                <FileSpreadsheet className="mb-3 h-10 w-10 text-green-600" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB · klicka för att byta fil
                </p>
              </>
            ) : (
              <>
                <CloudUpload className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Dra & släpp eller välj från dator</p>
                <p className="text-sm text-muted-foreground">
                  .xlsx, .xls, .csv — max 5 MB
                </p>
              </>
            )}
          </div>

          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-medium">
                Vi känner igen dessa kolumner
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Lag/Titel</Badge>
                <Badge variant="secondary">SFS-nummer</Badge>
                <Badge variant="secondary">Område</Badge>
                <Badge variant="secondary">Lagansvarig</Badge>
                <Badge variant="secondary">Kommentar</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Saknas en kolumn? Då kan ni komplettera manuellt i nästa steg.
              </p>
            </CardContent>
          </Card>

          <a
            href="/templates/laglista-import-mall.xlsx"
            download
            className="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Ladda ner mall (.xlsx)
          </a>
        </TabsContent>

        <TabsContent value="paste" className="space-y-3">
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Klistra in raderna här — en lag per rad eller kopiera direkt från Excel"
            className="min-h-[280px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Tips: Excel-paste använder tab-separerade kolumner med rubrikrad
            överst. En lag per rad fungerar också om du bara har titlar.
          </p>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col items-end gap-2">
        {phase === 'matching' && (
          <p
            className="text-xs text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            Det här tar oftast 10–30 sekunder för 50 rader.
          </p>
        )}
        <Button onClick={handleSubmit} disabled={submitDisabled} size="lg">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
          {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
