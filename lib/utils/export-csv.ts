/**
 * CSV export utility for document lists.
 * Extracted from export-dropdown.tsx for reuse in ViewMenu.
 */

import { getExportData } from '@/app/actions/document-list'

export async function exportListAsCsv(listId: string): Promise<void> {
  const result = await getExportData(listId)

  if (!result.success || !result.data) return

  const { listName, items } = result.data

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

  const csv = [headers.join(';'), ...rows.map((row) => row.join(';'))].join(
    '\n'
  )

  // Add BOM for Excel compatibility
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(listName)}-${formatDate(new Date())}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapeCsvField(field: string): string {
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
