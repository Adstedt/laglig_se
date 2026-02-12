/**
 * Cleans raw Riksdagen HTML for rendering in the app.
 *
 * Strips the metadata header (title, SFS nr, department, etc.) that is
 * already shown in our own UI, plus removes various artifacts.
 */
export function cleanLawHtml(html: string): string {
  let cleaned = html

  // Remove the title h2 at the start (we show it in our header)
  cleaned = cleaned.replace(/^<h2>[^<]+<\/h2>\s*/i, '')

  // Remove metadata block (SFS nr, Departement, etc.) — everything before first <hr />
  const hrIndex = cleaned.indexOf('<hr')
  if (hrIndex !== -1) {
    const hrEndIndex = cleaned.indexOf('>', hrIndex)
    if (hrEndIndex !== -1) {
      cleaned = cleaned.substring(hrEndIndex + 1)
    }
  }

  // Clean up leading whitespace and br tags
  cleaned = cleaned.replace(/^\s*<br\s*\/?>\s*/gi, '')

  // Remove all remaining hr tags — we use CSS borders for visual separation
  cleaned = cleaned.replace(/<hr\s*\/?>/gi, '')

  // Strip "/Träder i kraft I:YYYY-MM-DD/" metadata markers (rendered as <i> by Riksdagen)
  cleaned = cleaned.replace(
    /<i>\s*\/Träder i kraft I:\d{4}-\d{2}-\d{2}\/\s*<\/i>\s*/gi,
    ''
  )

  // Remove lone dots after </i> tags (Riksdagen artifact: "</i>.<p>")
  cleaned = cleaned.replace(/<\/i>\s*\.\s*(?=<)/gi, '</i>')

  // Remove lone dots that appear as paragraphs
  cleaned = cleaned.replace(/<p>\s*\.\s*<\/p>/gi, '')

  // Remove empty paragraphs
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '')

  // Remove paragraphs that only contain <br> tags
  cleaned = cleaned.replace(/<p>\s*(<br\s*\/?>)+\s*<\/p>/gi, '')

  // Ensure paragraf anchors have `id` for hash navigation (Riksdagen only sets `name`)
  cleaned = cleaned.replace(
    /<a\s+class="paragraf"\s+name="([^"]+)"(?!\s+id=)/g,
    '<a class="paragraf" name="$1" id="$1"'
  )

  return cleaned.trim()
}
