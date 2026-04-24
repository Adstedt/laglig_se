/**
 * Story 21.12 — Revisionsrapport PDF wrapper.
 *
 * Thin orchestrator around `@/lib/pdf/render-html-to-pdf`. The HTML argument
 * is the self-contained `<!DOCTYPE>…</html>` string produced by Story 21.11's
 * `renderRevisionsrapport`. This wrapper's only job is:
 *   1. Compose Puppeteer `headerTemplate` + `footerTemplate` strings with
 *      the seal-hash + kontroll-id placeholders baked in at call time.
 *   2. Apply the revisionsrapport-specific margins (larger top/bottom than
 *      the Tiptap document path so the running header/footer fits).
 *
 * Cover-page header behaviour (design simplification, documented in Story
 * 21.12 AC 6): Puppeteer's `displayHeaderFooter: true` renders the header on
 * every page including page 1. Native first-page suppression is not
 * supported. We accept the minor redundancy on the cover (which already
 * carries the full seal hash in its `seal-block`) rather than implement
 * fragile spacer-div workarounds. Flag to UX-expert if design review rejects.
 */

import { renderHtmlToPdf } from '@/lib/pdf/render-html-to-pdf'

export interface RevisionsrapportPdfMetadata {
  cycleIdShort: string // First 8 chars of cycle.id
  generatedAt: string // ISO string, formatted for display in footer
  sealHash: string | null // Full 64-char hash or null for pre-seal
}

// Puppeteer inserts its own 10pt sans-serif default for header/footer
// templates, ignoring the body's `@page` CSS rules. Force our own inline
// style so the running text matches the report's #666 muted palette.
const TEMPLATE_WRAPPER_STYLE =
  'font-size: 9pt; color: #666; font-family: Calibri, Segoe UI, Arial, sans-serif; width: 100%; padding: 0 2cm;'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHeaderTemplate(metadata: RevisionsrapportPdfMetadata): string {
  const truncatedHash = metadata.sealHash
    ? `${metadata.sealHash.slice(0, 16)}…`
    : ''

  // Puppeteer supports `.date` / `.title` / `.url` / `.pageNumber` /
  // `.totalPages` replacements. The right-aligned hash uses `flex`.
  return `<div style="${TEMPLATE_WRAPPER_STYLE} display: flex; justify-content: flex-end;">
    <span>${escapeHtml(truncatedHash)}</span>
  </div>`
}

function buildFooterTemplate(metadata: RevisionsrapportPdfMetadata): string {
  const sealSuffix = metadata.sealHash
    ? ` · Seal: ${escapeHtml(metadata.sealHash)}`
    : ''

  return `<div style="${TEMPLATE_WRAPPER_STYLE} display: flex; justify-content: space-between; align-items: center;">
    <span>Rapport genererad ${escapeHtml(metadata.generatedAt)} · Kontroll-ID: ${escapeHtml(metadata.cycleIdShort)}…${sealSuffix}</span>
    <span>Sida <span class="pageNumber"></span> av <span class="totalPages"></span></span>
  </div>`
}

/**
 * Render a revisionsrapport HTML document to PDF bytes, with running header
 * + footer templates that carry the seal hash + pagination across every page.
 */
export async function renderRevisionsrapportPdf(
  html: string,
  metadata: RevisionsrapportPdfMetadata
): Promise<Buffer> {
  return renderHtmlToPdf(html, {
    format: 'A4',
    margin: {
      top: '3cm',
      bottom: '2.5cm',
      left: '2cm',
      right: '2cm',
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: buildHeaderTemplate(metadata),
    footerTemplate: buildFooterTemplate(metadata),
  })
}
