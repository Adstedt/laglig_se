import { renderHtmlToPdf } from '@/lib/pdf/render-html-to-pdf'
import type { DocumentExportMetadata } from './tiptap-to-docx'

/**
 * Build a complete HTML document with metadata header and styles for PDF rendering.
 */
function buildHtmlDocument(
  contentHtml: string,
  metadata: DocumentExportMetadata
): string {
  const approvedLine = metadata.approvedAt
    ? `<p class="meta">Godkänd: ${new Date(metadata.approvedAt).toLocaleDateString('sv-SE')}</p>`
    : ''

  const documentNumberLine = metadata.documentNumber
    ? `<p class="meta">Dokumentnr: ${metadata.documentNumber}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
    }
    .metadata-header {
      border-bottom: 1px solid #ccc;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .metadata-header h1 {
      font-size: 20pt;
      margin-bottom: 4px;
    }
    .metadata-header .meta {
      font-size: 9pt;
      color: #666;
      margin: 2px 0;
    }
    .metadata-header .org {
      font-size: 9pt;
      color: #999;
      margin-top: 6px;
    }
    h1 { font-size: 18pt; margin: 18px 0 8px; }
    h2 { font-size: 14pt; margin: 14px 0 6px; }
    h3 { font-size: 12pt; margin: 12px 0 4px; }
    p { margin: 6px 0; }
    ul, ol { margin: 6px 0 6px 24px; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 8px 0;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 6px 8px;
      text-align: left;
      font-size: 10pt;
    }
    th { background: #f5f5f5; font-weight: 600; }
    img { max-width: 100%; height: auto; }
    a { color: #2563eb; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="metadata-header">
    <h1>${escapeHtml(metadata.title)}</h1>
    ${documentNumberLine}
    <p class="meta">Version: v${metadata.version} | Status: ${escapeHtml(metadata.status)}</p>
    ${approvedLine}
    <p class="org">${escapeHtml(metadata.workspaceName)}</p>
  </div>
  <div class="content">
    ${contentHtml}
  </div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Generate a PDF buffer from HTML content using Puppeteer + @sparticuz/chromium.
 * Designed for Vercel serverless deployment.
 *
 * Story 21.12: delegates to `@/lib/pdf/render-html-to-pdf` so the Puppeteer
 * launch path is shared with the revisionsrapport PDF pipeline. Behaviour
 * preserved byte-for-byte (same A4 + 2cm margins + printBackground defaults).
 */
export async function generatePdf(
  contentHtml: string,
  metadata: DocumentExportMetadata
): Promise<Buffer> {
  const html = buildHtmlDocument(contentHtml, metadata)
  return renderHtmlToPdf(html)
}
