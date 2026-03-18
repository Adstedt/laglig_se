/**
 * Amendment Summary Prompt
 *
 * Story 8.8: Generates brief, neutral summaries of SFS amendments
 * for notification emails and agent context.
 *
 * NOT the same as Story 12.3 (whole-law summering/kommentar).
 * This prompt answers "what changed and why does it matter?"
 * rather than "what does this law regulate?"
 */

// ============================================================================
// Types
// ============================================================================

export interface AmendmentSummaryInput {
  /** Amendment SFS number, e.g. "2026:109" */
  sfsNumber: string
  /** Amendment title, e.g. "Lag om ändring i skattebrottslagen (1971:69)" */
  title: string | null
  /** Full amendment text (from AmendmentDocument.markdown_content) */
  markdownContent: string
  /** When the change takes effect */
  effectiveDate: Date | null
}

export interface BaseLawContext {
  /** Base law title, e.g. "Skattebrottslag (1971:69)" */
  title: string
  /** Existing 12.3-generated summering of the base law (if available) */
  summary: string | null
}

export interface SectionChangeInfo {
  /** Chapter number, e.g. "7" or null */
  chapter: string | null
  /** Section number, e.g. "15" or "2a" */
  section: string
  /** AMENDED, REPEALED, NEW, RENUMBERED */
  changeType: string
}

// ============================================================================
// System Prompt
// ============================================================================

export function buildAmendmentSummaryPrompt(): string {
  return `Du får en ändringsförfattning (SFS) och kontext om baslagen den ändrar.

Skriv 2-3 meningar (max 60 ord) som beskriver:
1. Vilka delar av lagen som ändras och vad ändringen innebär i sak
2. Eventuell praktisk konsekvens (skärpta krav, nya skyldigheter, ändrade gränsvärden)
3. Ikraftträdandedatum om det framgår

Ton: saklig, neutral, informativ. Skriv för en person som redan följer lagen och snabbt vill förstå vad som ändrats.

VIKTIGT — anti-hallucination:
- Nämn ALDRIG specifika siffror (belopp, tidsfrister, antal år, straffskalor) som du inte kan verifiera ordagrant i ändringstexten nedan.
- Om du är osäker på en detalj, utelämna den hellre än att gissa.
- Basera din sammanfattning ENBART på den medföljande ändringstexten och paragrafstrukturen — hitta aldrig på information.

Skriv INTE "Vi ska" eller annan skyldighetsformulering.
Svara ENBART med sammanfattningen, ingen JSON, ingen rubrik.`
}

// ============================================================================
// User Message — Context Assembly
// ============================================================================

export function buildAmendmentContext(
  amendment: AmendmentSummaryInput,
  baseLaw: BaseLawContext,
  sectionChanges: SectionChangeInfo[]
): string {
  const parts: string[] = []

  // Amendment identity
  parts.push(`## Ändringsförfattning: SFS ${amendment.sfsNumber}`)
  if (amendment.title) {
    parts.push(`Titel: ${amendment.title}`)
  }
  if (amendment.effectiveDate) {
    parts.push(
      `Ikraftträdande: ${amendment.effectiveDate.toISOString().split('T')[0]}`
    )
  }

  // Base law context
  parts.push(`\n## Baslag: ${baseLaw.title}`)
  if (baseLaw.summary) {
    parts.push(`Sammanfattning av baslagen: ${baseLaw.summary}`)
  }

  // Section change structure
  if (sectionChanges.length > 0) {
    parts.push(`\n## Berörda paragrafer (${sectionChanges.length} st)`)
    for (const sc of sectionChanges) {
      const chapterPrefix = sc.chapter ? `${sc.chapter} kap. ` : ''
      const changeLabel = CHANGE_TYPE_LABELS[sc.changeType] ?? sc.changeType
      parts.push(`- ${chapterPrefix}${sc.section} § — ${changeLabel}`)
    }
  }

  // Amendment text — truncated to prevent hallucination on long documents.
  // The section change structure above gives the LLM the full scope;
  // the markdown provides substance for the first few sections.
  const truncated = truncateMarkdown(
    amendment.markdownContent,
    MAX_MARKDOWN_CHARS
  )
  parts.push('\n## Ändringstext' + (truncated.wasTruncated ? ' (utdrag)' : ''))
  parts.push(truncated.text)

  return parts.join('\n')
}

// Max chars of amendment markdown to include in the prompt.
// Keeps the LLM focused on the preamble + first few sections rather than
// losing context in a 10K+ char document.
const MAX_MARKDOWN_CHARS = 2000

function truncateMarkdown(
  text: string,
  maxChars: number
): { text: string; wasTruncated: boolean } {
  if (text.length <= maxChars) {
    return { text, wasTruncated: false }
  }
  // Cut at the last newline before maxChars to avoid mid-sentence truncation
  const cutPoint = text.lastIndexOf('\n', maxChars)
  const safeCut = cutPoint > maxChars * 0.5 ? cutPoint : maxChars
  return {
    text: text.slice(0, safeCut) + '\n\n[...resterande ändringstext utelämnad]',
    wasTruncated: true,
  }
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  AMENDED: 'ändrad',
  REPEALED: 'upphävd',
  NEW: 'ny',
  RENUMBERED: 'omnumrerad',
}
