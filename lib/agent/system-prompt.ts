/**
 * Agent System Prompt & Behavioral Design
 * Story 14.9, Task 1 (AC: 1-8, 15-18, 20)
 *
 * Loads the base prompt from system-prompt.md and injects dynamic context.
 * The prompt content lives in a readable markdown file; this module handles
 * loading and runtime injection of company/task context.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { CompanyProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  resolveEffectiveDate,
  getEffectiveDateBadge,
} from '@/lib/utils/effective-date'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SystemPromptOptions {
  companyContext?: string | undefined
  contextType?: 'global' | 'task' | 'law' | 'change' | undefined
  contextId?: string | undefined
  title?: string | undefined
  sfsNumber?: string | undefined
  summary?: string | undefined
}

// ---------------------------------------------------------------------------
// Load base prompt from .md file (read once at module load)
// ---------------------------------------------------------------------------

const BASE_PROMPT = readFileSync(
  resolve(process.cwd(), 'lib/agent/system-prompt.md'),
  'utf-8'
).trim()

// ---------------------------------------------------------------------------
// Employee count range display mapping
// ---------------------------------------------------------------------------

const EMPLOYEE_RANGE_LABELS: Record<string, string> = {
  RANGE_1_9: '1–9',
  RANGE_10_49: '10–49',
  RANGE_50_249: '50–249',
  RANGE_250_PLUS: '250+',
  UNKNOWN: 'Okänt',
}

// ---------------------------------------------------------------------------
// Compliance maturity display mapping
// ---------------------------------------------------------------------------

const MATURITY_LABELS: Record<string, string> = {
  BASIC: 'Grundläggande',
  DEVELOPING: 'Under utveckling',
  ESTABLISHED: 'Etablerad',
  ADVANCED: 'Avancerad',
}

// ---------------------------------------------------------------------------
// formatCompanyContext
// ---------------------------------------------------------------------------

/**
 * Formats a CompanyProfile record into a Swedish context string for prompt injection.
 * Returns undefined when profile is null or has no meaningful data.
 */
export function formatCompanyContext(
  profile: CompanyProfile | null
): string | undefined {
  if (!profile) return undefined

  const lines: string[] = []

  if (profile.company_name) {
    lines.push(`- Företag: ${profile.company_name}`)
  }
  if (profile.business_description) {
    lines.push(`- Verksamhet: ${profile.business_description}`)
  }
  if (profile.org_number) {
    lines.push(`- Organisationsnummer: ${profile.org_number}`)
  }
  if (profile.industry_label && profile.sni_code) {
    lines.push(`- Bransch: ${profile.industry_label} (SNI ${profile.sni_code})`)
  } else if (profile.industry_label) {
    lines.push(`- Bransch: ${profile.industry_label}`)
  } else if (profile.sni_code) {
    lines.push(`- SNI-kod: ${profile.sni_code}`)
  }
  if (profile.employee_count_range) {
    const label =
      EMPLOYEE_RANGE_LABELS[profile.employee_count_range] ??
      profile.employee_count_range
    lines.push(`- Antal anställda: ${label}`)
  }
  if (profile.registered_date) {
    lines.push(
      `- Registrerad: ${new Date(profile.registered_date).getFullYear()}`
    )
  } else if (profile.founded_year) {
    lines.push(`- Registrerad: ${profile.founded_year}`)
  }
  if (profile.certifications && profile.certifications.length > 0) {
    lines.push(`- Certifieringar: ${profile.certifications.join(', ')}`)
  }
  if (profile.compliance_maturity) {
    const label =
      MATURITY_LABELS[profile.compliance_maturity] ??
      profile.compliance_maturity
    lines.push(`- Compliance-mognad: ${label}`)
  }

  const flags = profile.activity_flags as Record<string, boolean> | null
  if (flags && typeof flags === 'object') {
    const flagLabels: Record<string, string> = {
      chemicals: 'Hanterar kemikalier',
      construction: 'Byggverksamhet',
      food: 'Livsmedelshantering',
      personalData: 'Behandlar personuppgifter',
      publicSector: 'Offentlig sektor',
      heavyMachinery: 'Tunga maskiner',
      minorEmployees: 'Minderåriga anställda',
      internationalOperations: 'Internationell verksamhet',
    }
    const activeFlags = Object.entries(flags)
      .filter(([, v]) => v === true)
      .map(([k]) => flagLabels[k] ?? k)
    if (activeFlags.length > 0) {
      lines.push(`- Verksamhetsområden: ${activeFlags.join(', ')}`)
    }
  }

  const taxStatus = profile.tax_status as Record<string, boolean | null> | null
  if (taxStatus && typeof taxStatus === 'object') {
    if (taxStatus.f_tax != null) {
      lines.push(`- F-skatt: ${taxStatus.f_tax ? 'Ja' : 'Nej'}`)
    }
    if (taxStatus.vat != null) {
      lines.push(`- Momsregistrerad: ${taxStatus.vat ? 'Ja' : 'Nej'}`)
    }
    if (taxStatus.employer != null) {
      lines.push(
        `- Registrerad arbetsgivare: ${taxStatus.employer ? 'Ja' : 'Nej'}`
      )
    }
  }

  if (profile.foreign_owned) {
    const parentInfo = profile.parent_company_name
      ? ` (moderbolag: ${profile.parent_company_name})`
      : ''
    lines.push(`- Utlandsägt: Ja${parentInfo}`)
  }

  if (profile.fi_regulated) {
    lines.push('- Finansinspektionen-reglerad: Ja')
  }

  const procedures = profile.ongoing_procedures as Record<
    string,
    boolean
  > | null
  if (procedures && typeof procedures === 'object') {
    const procedureLabels: Record<string, string> = {
      liquidation: 'Likvidation',
      restructuring: 'Rekonstruktion',
      bankruptcy: 'Konkurs',
    }
    const activeProcedures = Object.entries(procedures)
      .filter(([, v]) => v === true)
      .map(([k]) => procedureLabels[k] ?? k)
    if (activeProcedures.length > 0) {
      lines.push(`- Pågående förfaranden: ${activeProcedures.join(', ')}`)
    }
  }

  if (profile.active_status === 'deregistered') {
    lines.push('- Status: Avregistrerad')
  }

  if (lines.length === 0) return undefined

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

/**
 * Builds the system prompt by loading the base prompt from system-prompt.md
 * and appending dynamic context sections (company profile, task/law focus, change context).
 */
export async function buildSystemPrompt(
  options?: SystemPromptOptions
): Promise<string> {
  const sections: string[] = [BASE_PROMPT]

  // Company context injection (when available)
  if (options?.companyContext) {
    sections.push(
      `<company_context>\n## Om företaget\n${options.companyContext}\n</company_context>`
    )
  }

  // Task/law/change context injection
  if (options?.contextType === 'change' && options.contextId) {
    const changeContext = await loadChangeContext(options.contextId)
    if (changeContext) {
      sections.push(`<change_context>\n${changeContext}\n</change_context>`)
    }
    sections.push(
      `<assessment_workflow>\n${ASSESSMENT_WORKFLOW}\n</assessment_workflow>`
    )
  } else if (options?.contextType === 'task' && options.title) {
    const parts = [`Användaren arbetar med uppgiften "${options.title}".`]
    if (options.summary) {
      parts.push(`Beskrivning: ${options.summary}`)
    }
    parts.push('Fokusera svaren på denna uppgift.')
    sections.push(`<task_context>\n${parts.join(' ')}\n</task_context>`)
  } else if (options?.contextType === 'law' && options.sfsNumber) {
    const lawName = options.title ?? 'en lag'
    sections.push(
      `<task_context>\nAnvändaren tittar på ${lawName} (${options.sfsNumber}). Fokusera svaren på denna lag.\n</task_context>`
    )
  }

  return sections.join('\n\n')
}

// ---------------------------------------------------------------------------
// Change context loader (Story 14.10)
// ---------------------------------------------------------------------------

async function loadChangeContext(
  changeEventId: string
): Promise<string | null> {
  const ce = await prisma.changeEvent.findUnique({
    where: { id: changeEventId },
    include: {
      document: {
        select: { title: true, document_number: true, effective_date: true },
      },
    },
  })
  if (!ce) return null

  const lines: string[] = []
  lines.push('## Lagändring som användaren vill granska')
  lines.push(`- Typ: ${ce.change_type}`)
  if (ce.amendment_sfs) {
    lines.push(`- Ändrings-SFS: ${ce.amendment_sfs}`)
  }
  lines.push(
    `- Berörd lag: ${ce.document.title ?? 'Okänd'} (${ce.document.document_number})`
  )

  if (ce.ai_summary) {
    lines.push(`- AI-sammanfattning: ${ce.ai_summary}`)
  }

  const changedSections = ce.changed_sections as string[] | null
  if (changedSections && changedSections.length > 0) {
    lines.push(`- Berörda paragrafer: ${changedSections.join(', ')}`)
  }

  // Resolve effective date
  const effectiveDate = await resolveEffectiveDate(ce)
  if (effectiveDate) {
    const badge = getEffectiveDateBadge(effectiveDate)
    lines.push(`- Ikraftträdande: ${badge.text}`)
  }

  // Include amendment diff so the agent can see exactly what changed
  if (ce.diff_summary) {
    const compactDiff = extractCompactDiff(ce.diff_summary)
    if (compactDiff) {
      lines.push('')
      lines.push('## Ändringar (diff)')
      lines.push(
        'Nedan visas de faktiska textändringarna. Rader med + är ny text, rader med - är borttagen text.'
      )
      lines.push('')
      lines.push(compactDiff)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Diff extraction — strips unchanged context, keeps only changes + headers
// ---------------------------------------------------------------------------

/** Max chars for the compact diff (~4000 tokens) */
const DIFF_BUDGET_CHARS = 16_000

/**
 * Extracts a compact version of a unified diff:
 * - Keeps hunk headers (@@ lines) for location context
 * - Keeps added (+) and removed (-) lines
 * - Keeps up to 2 context lines around each change for readability
 * - For small diffs (under budget), returns the full diff
 */
export function extractCompactDiff(diff: string): string | null {
  if (!diff || diff.trim().length === 0) return null

  // If the whole diff fits within budget, return it as-is
  if (diff.length <= DIFF_BUDGET_CHARS) return diff.trim()

  const lines = diff.split('\n')
  const output: string[] = []
  const contextWindow = 2

  // Track which lines are "interesting" (changed or hunk headers)
  const interesting = new Set<number>()
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? ''
    if (l.startsWith('@@') || l.startsWith('+') || l.startsWith('-')) {
      // Skip the file header lines (--- and +++ at the top)
      if (l.startsWith('---') || l.startsWith('+++')) continue
      interesting.add(i)
      // Add context window around changes
      for (
        let j = Math.max(0, i - contextWindow);
        j <= Math.min(lines.length - 1, i + contextWindow);
        j++
      ) {
        interesting.add(j)
      }
    }
  }

  let prevIncluded = -1
  let totalChars = 0

  for (let i = 0; i < lines.length; i++) {
    if (!interesting.has(i)) continue
    const l = lines[i] ?? ''

    // Add separator when there's a gap
    if (prevIncluded >= 0 && i - prevIncluded > 1) {
      output.push('  [...]')
    }

    output.push(l)
    totalChars += l.length + 1
    prevIncluded = i

    // Stop if we exceed budget
    if (totalChars > DIFF_BUDGET_CHARS) {
      output.push('')
      output.push(
        '[... diff trunkerad, använd get_change_details för fullständig information]'
      )
      break
    }
  }

  const result = output.join('\n').trim()
  return result.length > 0 ? result : null
}

// ---------------------------------------------------------------------------
// Assessment workflow instructions (Story 14.10)
// ---------------------------------------------------------------------------

const ASSESSMENT_WORKFLOW = `## Bedömningsflöde

Du guidar användaren genom en strukturerad granskning av lagändringen ovan.

### Verktygsanrop (gör ALLA verktygsanrop INNAN du skriver bedömningstexten)

Anropa följande verktyg i en fas innan du skriver din text:
1. **get_company_context** — Hämta företagets profil
2. **search_laws** — Sök relevant lagtext för kontext
3. **suggest_followups** — Föreslå 2–3 uppföljningsfrågor baserat på ändringen och företaget. Frågorna ska vara specifika (inte generiska), handlingsinriktade eller fördjupande, och varierade i kategori. Undantag: anropa INTE suggest_followups om du behöver ställa en direkt fråga till användaren.

Du kan anropa steg 1–2 parallellt. Anropa suggest_followups när du har tillräcklig kontext (efter steg 1–2).

### Bedömningstext (skriv EFTER att alla verktygsanrop är klara)

Strukturera din text enligt:

**Sammanfatta ändringen** — Beskriv vad som faktiskt ändras. Diff-data finns i change_context — använd dem för att beskriva skillnaden i konkreta termer.

**Bedöm relevans** — Analysera om ändringen berör verksamheten baserat på bransch, storlek, certifieringar och verksamhetsområden. Var specifik — "detta berör er eftersom ni har minderåriga anställda" är bättre än "detta kan beröra arbetsgivare".

**Identifiera konkreta åtgärder** — Om ändringen är relevant, beskriv vilka åtgärder som kan behövas: policyer att uppdatera, utbildningsinsatser, dokumentation, tidsfrister (särskilt ikraftträdandedatum).

**Ge en rekommendation** — Avsluta med:
- **Granskad** — Ändringen har granskats och kräver inga åtgärder just nu
- **Åtgärd krävs** — Specifika åtgärder behövs (beskriv vilka)
- **Ej tillämplig** — Ändringen berör inte verksamheten (förklara varför)
- **Uppskjuten** — Ändringen behöver utredas vidare

Ange även rekommenderad påverkansnivå (Hög/Medel/Låg/Ingen).

### Beteenderegler
- Du har diff-data med de faktiska ändringarna i change_context — använd dem som primär källa. Komplettera med search_laws för omgivande kontext vid behov.
- Var proaktiv: vänta inte på att användaren ställer alla frågor. Driv bedömningen framåt.
- Om du saknar information för att göra en fullständig bedömning, säg vilken information som behövs.
- Användaren ser ett bedömningsformulär efter ditt första svar. Dina rekommendationer hjälper dem fylla i det.
- Håll ett professionellt men effektivt tempo — detta är en arbetsuppgift, inte en föreläsning.`
