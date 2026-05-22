'use client'

import { useCallback, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings, CalendarIcon, AlertTriangle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { updateDocumentMetadata } from '@/app/actions/documents'
import { WorkspaceDocumentType } from '@prisma/client'
import { getReviewDateStatus } from '@/lib/utils/review-date-status'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { DocumentLinksSection } from './document-links-section'

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

interface DocumentSettingsPanelProps {
  documentId: string
  initialDocumentNumber: string | null
  initialReviewDate: string | null
  initialDocumentType: string | null
  readOnly?: boolean
}

export function DocumentSettingsPanel({
  documentId,
  initialDocumentNumber,
  initialReviewDate,
  initialDocumentType,
  readOnly,
}: DocumentSettingsPanelProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [documentNumber, setDocumentNumber] = useState(
    initialDocumentNumber ?? ''
  )
  const [reviewDate, setReviewDate] = useState<Date | undefined>(
    initialReviewDate ? new Date(initialReviewDate) : undefined
  )
  const [documentType, setDocumentType] = useState(
    initialDocumentType ?? 'OTHER'
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    const result = await updateDocumentMetadata({
      documentId,
      documentNumber: documentNumber || null,
      reviewDate: reviewDate ? reviewDate.toISOString() : null,
      documentType: documentType as WorkspaceDocumentType,
    })
    setSaving(false)
    if (result.success) {
      toast.success('Inställningar sparade')
    } else {
      toast.error(result.error ?? 'Kunde inte spara inställningar')
    }
  }, [documentId, documentNumber, reviewDate, documentType])

  const reviewStatus = getReviewDateStatus(reviewDate ?? null)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle>Inställningar</SheetTitle>
          <SheetDescription className="sr-only">
            Redigera dokumentmetadata
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Document number */}
          <div>
            <span className="text-sm font-medium mb-1.5 block">
              Dokumentnummer
            </span>
            <Input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="T.ex. POL-2026-001"
              maxLength={50}
              disabled={readOnly}
            />
          </div>

          {/* Document type */}
          <div>
            <span className="text-sm font-medium mb-1.5 block">
              Dokumenttyp
            </span>
            <Select
              value={documentType}
              onValueChange={setDocumentType}
              disabled={!!readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Review date */}
          <div>
            <span className="text-sm font-medium mb-1.5 block">
              Granskningsdatum
            </span>
            <Popover>
              <PopoverTrigger asChild disabled={readOnly}>
                <Button
                  variant="outline"
                  disabled={readOnly}
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !reviewDate && 'text-muted-foreground',
                    reviewStatus === 'overdue' && 'border-red-300 text-red-700',
                    reviewStatus === 'upcoming' &&
                      'border-amber-300 text-amber-700'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reviewDate
                    ? format(reviewDate, 'PPP', { locale: sv })
                    : 'Välj datum...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={reviewDate}
                  onSelect={setReviewDate}
                  locale={sv}
                />
              </PopoverContent>
            </Popover>
            {reviewStatus === 'overdue' && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Förfallet granskningsdatum
              </p>
            )}
            {reviewStatus === 'upcoming' && (
              <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Granskning inom 30 dagar
              </p>
            )}
          </div>

          {/* Linked items */}
          <DocumentLinksSection documentId={documentId} readOnly={readOnly} />

          {/* Save button — hidden when read-only */}
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Sparar...' : 'Spara inställningar'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
