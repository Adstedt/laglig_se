'use client'

/**
 * Story 4.11: Export Dropdown
 * Export document list as CSV or PDF
 */

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { getExportData } from '@/app/actions/document-list'

interface ExportDropdownProps {
  listId: string | null
  listName: string
  disabled?: boolean
}

export function ExportDropdown({
  listId,
  listName: _listName,
  disabled,
}: ExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportCSV = async () => {
    if (!listId) return

    setIsExporting(true)

    try {
      const result = await getExportData(listId)

      if (result.success && result.data) {
        const { listName: name, items } = result.data

        // Create CSV content
        const headers = [
          'Titel',
          'Dokumentnummer',
          'Typ',
          'Status',
          'Prioritet',
          'Kommentar',
        ]

        const rows = items.map((item) => [
          escapeCsvField(item.title),
          escapeCsvField(item.documentNumber),
          escapeCsvField(item.contentType),
          escapeCsvField(item.status),
          escapeCsvField(item.priority),
          escapeCsvField(item.commentary ?? ''),
        ])

        const csv = [
          headers.join(';'),
          ...rows.map((row) => row.join(';')),
        ].join('\n')

        // Add BOM for Excel compatibility
        const bom = '\uFEFF'
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })

        // Download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${sanitizeFilename(name)}-${formatDate(new Date())}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export CSV error:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPDF = async () => {
    // PDF export would require a server-side PDF generation library
    // For MVP, we'll show a placeholder message
    alert('PDF-export kommer i en framtida version.')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          disabled={disabled || isExporting}
          title="Exportera lista"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportera som CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF} disabled>
          <FileText className="mr-2 h-4 w-4" />
          Exportera som PDF (kommer snart)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Helper functions
function escapeCsvField(field: string): string {
  // Escape double quotes and wrap in quotes if contains special chars
  if (field.includes('"') || field.includes(';') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9åäö]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatDate(date: Date): string {
  const isoString = date.toISOString()
  return isoString.slice(0, isoString.indexOf('T'))
}
