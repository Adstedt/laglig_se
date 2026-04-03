/**
 * Riksdagen Proposition Fetcher
 * Story 8.24: Enrich amendments with proposition context
 *
 * Extracts proposition references from amendment full text and fetches
 * title + "huvudsakligt innehåll" from the riksdagen.se open data API.
 */

const API_TIMEOUT_MS = 5_000

export interface PropositionContext {
  id: string // "2024/25:205"
  title: string // "Myndigheten för civilt försvar – ..."
  summary: string | null // Huvudsakligt innehåll section (tag-stripped)
  organ: string | null // "Försvarsdepartementet"
  datum: Date | null // When proposition was submitted
}

/**
 * Extracts the first proposition reference from amendment full text.
 * Returns null for förordningar (which use "Regeringen föreskriver" instead).
 */
export function extractPropositionRef(fullText: string): string | null {
  const match = fullText.match(/[Pp]rop\.\s*(\d{4}\/\d{2}:\d+)/)
  return match?.[1] ?? null
}

/**
 * Fetches proposition context from riksdagen.se API.
 * Two-step: search API for metadata, then text API for huvudsakligt innehåll.
 * Returns null on any failure (timeout, no results, malformed response).
 */
export async function fetchPropositionContext(
  propRef: string
): Promise<PropositionContext | null> {
  try {
    // Step 1: Search API for proposition metadata
    const searchUrl = `https://data.riksdagen.se/dokumentlista/?sok=${encodeURIComponent(propRef)}&doktyp=prop&utformat=json&a=s`
    const searchRes = await fetchWithTimeout(searchUrl, API_TIMEOUT_MS)
    if (!searchRes.ok) return null

    const searchData = await searchRes.json()
    const doc = searchData?.dokumentlista?.dokument?.[0]
    if (!doc?.titel) return null

    const context: PropositionContext = {
      id: propRef,
      title: doc.titel,
      summary: null,
      organ: doc.organ || null,
      datum: doc.datum ? parseDate(doc.datum) : null,
    }

    // Step 2: Fetch full text to extract "huvudsakligt innehåll"
    const dokId = doc.dok_id
    if (dokId) {
      const textUrl = `https://data.riksdagen.se/dokument/${dokId}.text`
      const textRes = await fetchWithTimeout(textUrl, API_TIMEOUT_MS)
      if (textRes.ok) {
        const text = await textRes.text()
        context.summary = extractHuvudsakligtInnehall(text)
      }
    }

    return context
  } catch (err) {
    console.warn(
      `[proposition-fetcher] Failed to fetch prop ${propRef}:`,
      err instanceof Error ? err.message : err
    )
    return null
  }
}

/**
 * Extracts the "Propositionens huvudsakliga innehåll" section from
 * riksdagen.se document text. Strips HTML tags, returns clean text.
 */
export function extractHuvudsakligtInnehall(text: string): string | null {
  const idx = text.search(/[Pp]ropositionens\s+huvudsakliga\s+inneh[åa]ll/i)
  if (idx < 0) return null

  // Take content after the heading, up to next page break or ~2000 chars
  const afterHeading = text.substring(idx)

  // Find end: page div break
  const endMatch = afterHeading.search(/&lt;DIV\s+id="page_\d+"/i)
  const endIdx = endMatch > 50 ? endMatch : Math.min(afterHeading.length, 2000)

  const section = afterHeading.substring(0, endIdx)

  // Strip HTML entities and tags
  const clean = section
    .replace(/&lt;[^&]*?&gt;/g, '') // HTML-encoded tags
    .replace(/<[^>]+>/g, '') // regular HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    // Remove the heading itself
    .replace(/[Pp]ropositionens\s+huvudsakliga\s+inneh[åa]ll/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  return clean.length > 10 ? clean : null
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}
