/**
 * Story 17.8: the MIME types the extraction pipeline can ingest.
 *
 * Kept in a dependency-free module so the upload path (`app/actions/files.ts`)
 * can decide PENDING vs UNSUPPORTED without importing `extract-file.ts` (which
 * pulls in xlsx / papaparse / the Anthropic SDK).
 */

export const EXTRACTABLE_MIME = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS: 'application/vnd.ms-excel',
  CSV: 'text/csv',
  TXT: 'text/plain',
  MD: 'text/markdown',
} as const

const EXTRACTABLE_SET: ReadonlySet<string> = new Set(
  Object.values(EXTRACTABLE_MIME)
)

/** True when a file of this MIME type can be extracted → upload stamps PENDING. */
export function isExtractableMimeType(
  mime: string | null | undefined
): boolean {
  return mime != null && EXTRACTABLE_SET.has(mime)
}
