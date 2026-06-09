/**
 * Story 17.8: Generic document-transcription prompt + a lightweight output
 * sanity check for the uploaded-file ingestion pipeline.
 *
 * This is the PDF path's equivalent of the SFS amendment prompt, but generic:
 * arbitrary user documents (policies, kollektivavtal, certificates, …) are NOT
 * SFS amendments, so we do NOT reuse `AMENDMENT_PDF_SYSTEM_PROMPT` nor the SFS
 * `validateLlmOutput` (which hard-requires `article.legal-document` scaffolding).
 *
 * Faithfulness is non-negotiable for compliance content — the prompt forbids
 * summarising/omitting, and `validateExtraction` rejects empty or truncated
 * output so a half-streamed transcription never reaches the RAG index.
 */

/** System prompt: transcribe a document (sent as a `document` block) to clean,
 *  verbatim semantic HTML. Output is HTML only — converted to markdown downstream. */
export const FILE_TRANSCRIPTION_PROMPT = `You are a faithful document transcription engine. You will be given a document (often a PDF, which may be scanned). Transcribe its FULL textual content into clean, semantic HTML.

Rules:
- Transcribe FAITHFULLY and IN FULL. Preserve every word, number, heading, list item, and table cell exactly as written.
- NEVER summarise, omit, paraphrase, translate, re-order, comment on, or invent content. Output only what the document actually contains.
- Use semantic HTML only: <h1>–<h3> for headings, <p> for paragraphs, <ul>/<ol>/<li> for lists, <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables, and <strong>/<em> only where emphasis is genuinely present.
- Preserve the document's reading order and logical structure.
- For scanned or image-based pages, perform OCR and transcribe the recognised text.
- Skip blank pages and pure decoration silently; do not describe images.
- Output ONLY the HTML. No markdown code fences, no preamble, no trailing commentary.`

export interface ExtractionValidation {
  ok: boolean
  /** Length of the tag-stripped plaintext, in characters. */
  textLength: number
  /** Present when `ok` is false. `no text content` → caller maps to EMPTY;
   *  any other reason → FAILED. */
  reason?: string
}

/** Cheap, deterministic, generic sanity check on transcription HTML.
 *  Deliberately NOT the SFS `validateLlmOutput` — no legal-document structure
 *  is required here. */
export function validateExtraction(html: string): ExtractionValidation {
  if (!html || html.trim().length === 0) {
    return { ok: false, textLength: 0, reason: 'empty output' }
  }

  // Truncation guard: a trailing `<…` with no closing `>` means the model's
  // output was cut off mid-tag (e.g. token limit) — reject as FAILED.
  if (html.lastIndexOf('<') > html.lastIndexOf('>')) {
    return {
      ok: false,
      textLength: stripTags(html).length,
      reason: 'truncated mid-tag',
    }
  }

  const textLength = stripTags(html).length
  if (textLength === 0) {
    return { ok: false, textLength: 0, reason: 'no text content' }
  }

  return { ok: true, textLength }
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
