import mammoth from 'mammoth'
import {
  htmlToTiptapJson,
  type TiptapDocumentJSON,
} from './html-to-tiptap-json'
import { getStorageClient } from '@/lib/supabase/storage'

const BUCKET_NAME = 'workspace-files'

// ---------------------------------------------------------------------------
// mammoth .docx → HTML
// ---------------------------------------------------------------------------

/**
 * Convert a .docx buffer to HTML using mammoth.
 * Handles both English and Swedish heading style names.
 * Clamps H4-H6 to H3 via post-processing.
 */
export async function convertDocxToHtml(
  buffer: Buffer
): Promise<{ html: string; messages: string[] }> {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1",
        "p[style-name='Heading 2'] => h2",
        "p[style-name='Heading 3'] => h3",
        "p[style-name='Heading 4'] => h3",
        "p[style-name='Heading 5'] => h3",
        "p[style-name='Heading 6'] => h3",
        "p[style-name='Rubrik 1'] => h1",
        "p[style-name='Rubrik 2'] => h2",
        "p[style-name='Rubrik 3'] => h3",
        "p[style-name='Rubrik 4'] => h3",
        "p[style-name='Rubrik 5'] => h3",
        "p[style-name='Rubrik 6'] => h3",
      ],
    }
  )
  // Also clamp any native h4-h6 tags to h3 in case mammoth produces them
  let html = result.value
  html = html.replace(/<h[4-6]([ >])/gi, '<h3$1')
  html = html.replace(/<\/h[4-6]>/gi, '</h3>')

  return {
    html,
    messages: result.messages.map((m) => m.message),
  }
}

// ---------------------------------------------------------------------------
// Image extraction and re-upload
// ---------------------------------------------------------------------------

/**
 * Find all base64 data URI images in HTML, re-upload to Supabase Storage,
 * and replace with public URLs.
 */
export async function extractAndUploadImages(
  html: string,
  workspaceId: string,
  _documentId: string
): Promise<string> {
  const base64Regex = /src="data:(image\/[^;]+);base64,([^"]+)"/g
  const matches: Array<{ full: string; mimeType: string; data: string }> = []

  let match
  while ((match = base64Regex.exec(html)) !== null) {
    matches.push({
      full: match[0]!,
      mimeType: match[1]!,
      data: match[2]!,
    })
  }

  if (matches.length === 0) return html

  const storageClient = getStorageClient()
  let result = html

  for (const img of matches) {
    const buffer = Buffer.from(img.data, 'base64')
    const ext = img.mimeType.split('/').at(1) ?? 'png'
    const imageId = crypto.randomUUID()
    const storagePath = `${workspaceId}/document-images/${imageId}/image.${ext}`

    const { error: uploadError } = await storageClient.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: img.mimeType,
        upsert: false,
      })

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = storageClient.storage.from(BUCKET_NAME).getPublicUrl(storagePath)
      result = result.replace(img.full, `src="${publicUrl}"`)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Full pipeline: .docx → Tiptap JSON
// ---------------------------------------------------------------------------

export interface DocxConversionResult {
  json: TiptapDocumentJSON
  html: string
  extractedText: string
  messages: string[]
}

/**
 * Full conversion pipeline: .docx buffer → mammoth HTML → (optional image upload) → Tiptap JSON.
 * If workspaceId and documentId are provided, embedded images are re-uploaded to Supabase.
 */
export async function convertDocxToTiptap(
  buffer: Buffer,
  workspaceId?: string,
  documentId?: string
): Promise<DocxConversionResult> {
  // Step 1: mammoth .docx → HTML
  const { html: rawHtml, messages } = await convertDocxToHtml(buffer)

  // Step 2: Re-upload embedded images (if workspace context provided)
  const html =
    workspaceId && documentId
      ? await extractAndUploadImages(rawHtml, workspaceId, documentId)
      : rawHtml

  // Step 3: HTML → Tiptap JSON
  const json = htmlToTiptapJson(html)

  // Step 4: Extract plaintext
  const extractedText = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { json, html, extractedText, messages }
}
